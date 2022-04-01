/**
 * @file prototype.js
 *
 * @brief Avatar Picker: Standalone Prototype
 *
 * @author Callum Prentice (callum@lindenlab.com)
 *
 * @date April 2022
 */

/*
 TODO:


* Once initial set is loaded and interactive, load everything else
* define inital body name in JSON vs code (let initial_name = "male_body_1_head_1";)
    * also define defaultState() in JSON
* can bodies share items (shirts etc.) - if so, we should only load once
* write functions to select body based on nody and head
    * Compose a name based on selection and then use setBodyByName (see original)

* only enable proceed when a full "set" is selected (body, shirt, pants) - what else?

* rename test_load_body_and_dependencies() to somethnig real
* backup and clean out old code/functions from this file

* write README with
    * program design
    * gotchas
        * names in JSON must all be unique


*/

import * as THREE from "./three.module.js";
import { OrbitControls } from "./OrbitControls.js";
import { GLTFLoader } from "./GLTFLoader.js";
import * as SkeletonUtils from "./SkeletonUtils.js";

window.setItemByName = setItemByName;
window.remItemByName = remItemByName;
window.remItemByLocation = remItemByLocation;

const configFilename = "data.json";
const bodyCategory = "body";
const itemCategory = "item";
const skinCategory = "skin";
const lowerLocation = "lower";
const upperLocation = "upper";
const headLocation = "head";
let selectedBodyName;
let scene, renderer, camera;
let clock = new THREE.Clock();
let animationMixers = [];
const manager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(manager);
const textureLoader = new THREE.TextureLoader(manager);
let skinTextureMap = new Map();

manager.onStart = function (url, itemsLoaded, itemsTotal) {
    console.log(
        "Started loading file: " +
            url +
            ".\nLoaded " +
            itemsLoaded +
            " of " +
            itemsTotal +
            " files."
    );
};

manager.onLoad = function () {
    console.log("Loading complete");
};

manager.onProgress = function (url, itemsLoaded, itemsTotal) {
    let percent_loaded = parseInt((itemsLoaded * 100) / itemsTotal);
    console.log(`Percent complete: ${percent_loaded}`);
};

manager.onError = function (url) {
    console.error("There was an error loading " + url);
};

async function loadConfig(filename) {
    let response = await fetch(filename);
    let data = await response.json();

    return data;
}

const loadAsync = (loader, url, name, category, location, inv_data) => {
    return new Promise((resolve) => {
        loader.load(url, (payload) => {
            resolve({
                name: name,
                category: category,
                location: location,
                payload: payload,
                inv_data: inv_data,
            });
        });
    });
};

async function loadResources(skin_textures, body_gltfs, item_gltfs) {
    let loaders = [];

    skin_textures.forEach(function (each) {
        loaders.push(
            loadAsync(
                textureLoader,
                each.lower,
                each.name,
                each.category,
                lowerLocation,
                each.inv_data
            )
        );
        loaders.push(
            loadAsync(
                textureLoader,
                each.upper,
                each.name,
                each.category,
                upperLocation,
                each.inv_data
            )
        );
        loaders.push(
            loadAsync(
                textureLoader,
                each.head,
                each.name,
                each.category,
                headLocation,
                each.inv_data
            )
        );
    });

    body_gltfs.forEach(function (each) {
        loaders.push(
            loadAsync(
                gltfLoader,
                each.filename,
                each.name,
                each.category,
                "",
                each.inv_data
            )
        );
    });

    item_gltfs.forEach(function (each) {
        loaders.push(
            loadAsync(
                gltfLoader,
                each.filename,
                each.name,
                each.category,
                each.location,
                each.inv_data
            )
        );
    });

    return await Promise.all(loaders);
}

function preloadStartData(config_data) {
    let body_gltfs = [];
    let item_gltfs = [];
    let skin_textures = [];

    config_data.bodies.forEach(function (body) {
        if (body.preload) {
            body_gltfs.push(body);
        }
    });

    config_data.items.forEach(function (item) {
        if (item.preload) {
            item_gltfs.push(item);
        }
    });

    config_data.skins.forEach(function (skin) {
        if (skin.preload) {
            skin_textures.push(skin);
        }
    });

    console.log("Preloading starting data GLTFs and skins", body_gltfs);

    loadResources(skin_textures, body_gltfs, item_gltfs)
        .then((data) => {
            console.log("Preloaded initial data - now initializing WebGL");
            initWebGL(data);

            console.log("WebGL initialized - now loading rest of data");
            loadMainData(config_data);
        })
        .catch((err) => {
            console.error(err);
        });
}

function loadMainData(config_data) {
    let body_gltfs = [];
    let item_gltfs = [];
    let skin_textures = [];

    config_data.bodies.forEach(function (body) {
        if (body.preload == false) {
            body_gltfs.push(body);
        }
    });

    config_data.items.forEach(function (item) {
        if (item.preload == false) {
            item_gltfs.push(item);
        }
    });

    config_data.skins.forEach(function (skin) {
        if (skin.preload == false) {
            skin_textures.push(skin);
        }
    });

    console.log("Loading main data GLTFs in background", body_gltfs);

    loadResources(skin_textures, body_gltfs, item_gltfs)
        .then((data) => {
            console.log("Data loading all complete");

            addToScene(data, false);
        })
        .catch((err) => {
            console.error(err);
        });
}

function initWebGL(loaded_data) {
    console.log("Initializing WebGL");

    console.log(`three.js: ${THREE.REVISION}`);

    const container = document.getElementById("container");

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.01,
        10
    );
    camera.position.set(0, 2.0, 1.2);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x6666aa);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.635;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 1.1, 0);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(-3, 10, -10);
    dirLight.castShadow = true;
    dirLight.shadow.bias = 0.005;
    dirLight.shadow.camera.top = 2;
    dirLight.shadow.camera.bottom = -2;
    dirLight.shadow.camera.left = -2;
    dirLight.shadow.camera.right = 2;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 40;
    scene.add(dirLight);

    const floor_geometry = new THREE.PlaneGeometry(2, 2);
    const floor_material = new THREE.MeshPhongMaterial({
        color: 0x666699,
        depthWrite: false,
    });
    const floor_mesh = new THREE.Mesh(floor_geometry, floor_material);
    floor_mesh.rotation.x = -Math.PI / 2;
    floor_mesh.receiveShadow = true;
    scene.add(floor_mesh);

    scene.add(new THREE.GridHelper(2, 60, 0xff0000, 0xaa66aa));

    renderer.setAnimationLoop(function () {
        controls.update();

        const delta = clock.getDelta();
        animationMixers.forEach(function (each) {
            each.update(delta);
        });

        renderer.render(scene, camera);
    });

    window.addEventListener(
        "resize",
        function () {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        },
        false
    );
}

function addToScene2(loaded_data, visible) {
    loaded_data.forEach(function (each) {
        if (each.category == bodyCategory || each.category == itemCategory) {
            let gltf = each.payload;
            let gltf_model = SkeletonUtils.clone(gltf.scene);

            gltf_model.position.set(
                Math.random() / 2 - 0.25,
                0.0,
                Math.random() / 2 - 0.25
            );

            gltf_model.visible = visible;
            gltf_model.userData.name = each.name;
            gltf_model.userData.category = each.category;
            gltf_model.userData.inv_data = each.inv_data;

            scene.add(gltf_model);
        } else if (each.category == skinCategory) {
            let stm = skinTextureMap.get(each.name);
            if (stm == undefined) {
                stm = skinTextureMap.set(each.name, {
                    lower: "",
                    upper: "",
                    head: "",
                    inv_data: each.inv_data,
                });
            }

            skinTextureMap.set(each.name, {
                lower:
                    each.location == lowerLocation ? each.payload : stm.lower,
                upper:
                    each.location == upperLocation ? each.payload : stm.upper,
                head: each.location == headLocation ? each.payload : stm.head,
                inv_data: each.inv_data,
            });
        }
    });
}

function startApp() {
    loadConfig(configFilename).then((config_data) => {
        console.log("Loading configuration data:", config_data);

        preloadStartData(config_data);
    });
}
