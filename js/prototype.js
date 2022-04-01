/**
 * @file prototype.js
 *
 * @brief Avatar Picker: Standalone Prototype
 *
 * @author Callum Prentice (callum@lindenlab.com)
 *
 * @date April 2022
 */

//WEDNESDAY:
// * Create animation groups - see how it works in original first
// * Add in code to show/hide as per first prototype
// * Try to factor preloadStartData and loadMainData into single function
// * only enable onscreen buttons when everything is loaded
//     * alternatively, start enabled and load item using same pattern as
//       the initial loads - may or may not be ready but that's okay although
//     * i do need to check if it's already loaded yet - reinstante "loaded" flag?
// * only enable proceed when a full "set" is selected (body, shirt, pants) - what else?

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

///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////

function getItemByName(config_data, name) {
    let item_data = undefined;

    config_data.items.every(function (item) {
        if (item.name == name) {
            item_data = item;
            return false;
        }
        return true;
    });

    return item_data;
}

async function load_body_and_dependencies(config_data, name) {
    let loaders = [];

    config_data.bodies.every(function (body) {
        if (body.name == name) {
            console.log(`Found match: ${name}`);
            console.log(`Adding GLB file for the body to load list`);
            loaders.push(
                loadAsync(
                    gltfLoader,
                    body.filename,
                    body.name,
                    body.category,
                    "",
                    body.inv_data
                )
            );

            body.items.forEach(function (item) {
                let item_data = getItemByName(config_data, item);
                console.log("Adding item:", item_data.name);
                loaders.push(
                    loadAsync(
                        gltfLoader,
                        item_data.filename,
                        item_data.name,
                        item_data.category,
                        item_data.location,
                        item_data.inv_data
                    )
                );
            });

            // now we have a list of loaders for the body and associated items
            // TOOD: missing textures but we can add that later - ideally by specifying a list of textures to load in the body block

            // Now we load the items

            return false;
        }

        return true;
    });

    console.log(`There are ${loaders.length} items to load`);

    return await Promise.all(loaders);
}

function nextStage() {
    console.log("Now moving on to the next stage of the application");
}

function addToScene(name, loaded_data) {
    let body_data = undefined;
    loaded_data.every(function (each) {
        if (each.category == bodyCategory) {
            body_data = each;
            return false;
        }
        return true;
    });

    if (body_data == undefined) {
        console.error(`Unable to load body and items for ${name}`);
        return;
    }

    let body_gltf = body_data.payload;
    let body_model = SkeletonUtils.clone(body_gltf.scene);

    let animation_object_group;
    let animation_mixer;
    let animation_clip;

    animation_object_group = new THREE.AnimationObjectGroup(body_model);
    animation_mixer = new THREE.AnimationMixer(animation_object_group);

    if (body_gltf.animations.length > 0) {
        animation_clip = body_gltf.animations[0];
        animation_mixer.clipAction(animation_clip).play();
    } else {
        console.error(`There is no animation present for body: ${body.name}`);
        return
    }

    body_model.visible = false;
    body_model.userData.name = body_data.name;
    body_model.userData.category = body_data.category;
    body_model.userData.inv_data = body_data.inv_data;
    scene.add(body_model);

    loaded_data.forEach(function (each) {
        if (each.category == itemCategory) {
            let item_gltf = each.payload;
            let item_model = SkeletonUtils.clone(item_gltf.scene);

            item_model.visible = false;
            item_model.userData.name = each.name;
            item_model.userData.category = each.category;
            item_model.userData.location = each.location;
            item_model.userData.inv_data = each.inv_data;

            animation_object_group.add(item_model);

            scene.add(item_model);
        }
    });

    animationMixers.push(animation_mixer);
}



function setBodyByName(body_name) {
    removeAllItems();

    scene.traverse(function (object) {
        if (object.userData.category == 'body') {
            if (object.userData.name == body_name) {
                object.visible = true;
                selectedBodyName = body_name;
            } else {
                object.visible = false;
            }
        }
    });
}

function removeAllItems() {
    scene.traverse(function (object) {
        if (object.userData.category == 'item') {
            object.visible = false;
        }
    });
}

function remItemByName(item_name) {
    scene.traverse(function (object) {
        if (object.userData.category == 'item') {
            if (object.userData.name == item_name) {
                object.visible = false;
            }
        }
    });
}

function remItemByLocation(item_location) {
    scene.traverse(function (object) {
        if (object.userData.category == 'item') {
            if (object.userData.location == item_location) {
                object.visible = false;
            }
        }
    });
}

function setItemByName(item_name) {
    let item_object;
    scene.traverse(function (object) {
        if (object.userData.category == 'item') {
            if (object.userData.name == item_name) {
                item_object = object;
            }
        }
    });

    if (item_object == undefined) {
        console.warn(`setItemByName - unable to find item ${item_name}`)
        return
    }

    scene.traverse(function (object) {
        if (object.userData.category == 'item') {
            if (object.userData.location == item_object.userData.location) {
                object.visible = false;
            }

            if (object.userData.name == item_name) {
                object.visible = true;
            }
        }
    });
}

function test_load_body_and_dependencies() {
    loadConfig(configFilename).then((config_data) => {
        console.warn("Loaded configuration data:", config_data);

        let initial_name = "male_body_1_head_1";
        load_body_and_dependencies(config_data, initial_name)
            .then((loaded_data) => {
                console.log(`Loaded all data for ${initial_name}`);
                console.log(loaded_data);
                initWebGL(config_data);
                addToScene(initial_name, loaded_data, true);
                setBodyByName('male_body_1_head_1')
                setItemByName('male_shirt_1')
                setItemByName('male_pants_2')
            })
            .catch((err) => {
                console.error(err);
            });
    });
}

// startApp();
test_load_body_and_dependencies();
