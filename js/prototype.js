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
 ============================== TODO ==============================



* implement skins
    * consider loading 3 skins and attaching to userData in body

* define initial body name in JSON vs code (let initial_name = "male_body_1_head_1";)
    * also define defaultMaleState() and defaultFemaleState() in JSON

* Ask Chronos to replace Legs.001/Torso.001 and Top/Bottom with upper/lower

* look for TODOs

* consider other items
    * hair
    * shoes

* make app look like steeltoe's prototype
    * add graded shaded background
    * remove platform avatar stands on

* comment out or remove most of the console.log statements

* backup and clean out old code/functions from this file

* convert all " chars to ' ones

* write README with
    * program design
    * gotchas
        * names in JSON must all be unique


 ======================== UX/UI/PRODUCT QUESTIONS ========================
 * How should loading work?
   * There is a lot of data to load so need a strategy
   * Currently loads default avatar/clothes and app becomes interactive
   * Then loads rest in background but still need to wait for all to load

 * Describe what happens when you change bodies or sexes
    * resulting body is naked?
    * Resulting body has default clothing
    * Something else?

 * Should avatar float in space or have a platform like my prototype
    * if just floating then i will remove shadows


*/

import * as THREE from "./three.module.js";
import { OrbitControls } from "./OrbitControls.js";
import { GLTFLoader } from "./GLTFLoader.js";
import * as SkeletonUtils from "./SkeletonUtils.js";

window.setSex = setSex;
window.setItemByName = setItemByName;
window.remItemByName = remItemByName;
window.remItemByLocation = remItemByLocation;
window.setBodyByBodyNumber = setBodyByBodyNumber;
window.setBodyByHeadNumber = setBodyByHeadNumber;
window.setSkinByName = setSkinByName;
window.publishInvData = publishInvData;

const configFilename = "data.json";
const femaleSex = "female";
const maleSex = "male";
const bodyCategory = "body";
const itemCategory = "item";
const lowerLocation = "lower";
const upperLocation = "upper";
let selectedBodyName = "Waiting..";

let curBodyNumber = "1"; // TODO: set from JSON
let curHeadNumber = "1"; // TODO: set from JSON
let curSex = ""; // TODO: set from JSON

let scene, renderer, camera;
let clock = new THREE.Clock();
let animationMixers = [];
const manager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(manager);
const textureLoader = new THREE.TextureLoader(manager);
let skinTextureMap = new Map();

manager.onStart = function (url, itemsLoaded, itemsTotal) {
    console.log("Started loading data");
    //console.log("Started loading file: " + url + ".\nLoaded " + itemsLoaded + " of " + itemsTotal + " files.");
};

manager.onLoad = function () {
    console.log("Loading complete");
};

manager.onProgress = function (url, itemsLoaded, itemsTotal) {
    //let percent_loaded = parseInt((itemsLoaded * 100) / itemsTotal);
    //console.log(`Percent complete: ${percent_loaded}`);
};

manager.onError = function (url) {
    console.error("There was an error loading " + url);
};

function updateDebugDisplay() {
    let el = document.getElementById("debug_display");
    let debug_str = "<em>Debug Data:</em><br>";

    scene.traverse(function (object) {
        if (object.userData.category != undefined) {
            if (object.userData.category == bodyCategory) {
                if (object.visible) {
                    debug_str += `<br><i>body_name:</i> ${object.userData.name}`;

                    object.traverse(function (body_object) {
                        if (body_object.isMesh) {
                            if (body_object.material.userData.name != undefined) {
                                debug_str += `<br><i>skin_name:</i> ${body_object.material.userData.name}`;
                            }
                        }
                    });
                }
            }
            if (object.userData.category == itemCategory) {
                if (object.visible) {
                    debug_str += `<br><i>item_name:</i> ${object.userData.name}`;
                }
            }
        }
    });
    el.innerHTML = debug_str;
}

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

function getItemByName(config_data, name) {
    let item_data;

    config_data.items.every(function (item) {
        if (item.name == name) {
            item_data = item;
            return false;
        }
        return true;
    });

    return item_data;
}

function getSkinByName(config_data, name) {
    let skin_data;

    config_data.skins.every(function (skin) {
        if (skin.name == name) {
            skin_data = skin;
            return false;
        }
        return true;
    });

    return skin_data;
}

async function loadBodyandItems(config_data, name) {
    let loaders = [];

    config_data.bodies.every(function (body) {
        if (body.name == name) {
            //console.log(`Adding GLB file for the body to load list`);
            loaders.push(loadAsync(gltfLoader, body.filename, body.name, body.category, "", body.inv_data));

            body.items.forEach(function (item) {
                let item_data = getItemByName(config_data, item);
                //console.log("Adding item:", item_data.name);
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

            body.skins.forEach(function (skin) {
                let skin_data = getSkinByName(config_data, skin);
                //console.log("Adding skin:", skin_data);

                if (skinTextureMap.has(skin_data.name) == false) {
                    let lower_texture = textureLoader.load(skin_data.lower);
                    lower_texture.flipY = true;
                    let upper_texture = textureLoader.load(skin_data.upper);
                    upper_texture.flipY = true;
                    let head_texture = textureLoader.load(skin_data.head);
                    head_texture.flipY = true;

                    let inv_data = skin_data.inv_data;

                    skinTextureMap.set(skin_data.name, {
                        lower: lower_texture,
                        upper: upper_texture,
                        head: head_texture,
                        inv_data: inv_data,
                    });
                }
            });

            return false;
        }

        return true;
    });

    return await Promise.all(loaders);
}

function addToScene(loaded_data) {
    let body_data;
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
        console.error(`There is no animation present for body: ${name}`);
        return;
    }

    let body_skeleton;
    body_model.traverse(function (object) {
        if (object.isSkinnedMesh) {
            body_skeleton = object.skeleton;
        }
    });

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
            item_model.userData.body_name = body_model.userData.name;
            item_model.userData.category = each.category;
            item_model.userData.location = each.location;
            item_model.userData.inv_data = each.inv_data;

            item_model.traverse(function (object) {
                if (object.isSkinnedMesh) {
                    // Here we copy over the position, rotation & scale from
                    // the body skeleton bones to the shirt bones. This appears
                    // to do the right thing only when the morph bones exported
                    // from Blender using Avatar have the correct scale value
                    object.skeleton.bones.forEach(function (bone, index) {
                        bone.position.copy(body_skeleton.bones[index].position);
                        bone.scale.copy(body_skeleton.bones[index].scale);
                        bone.rotation.copy(body_skeleton.bones[index].rotation);
                    });

                    object.skeleton.update();
                }
            });

            animation_object_group.add(item_model);

            scene.add(item_model);
        }
    });

    animationMixers.push(animation_mixer);
}

function setSex(sex) {
    if (sex == curSex) {
        return;
    }

    curSex = sex;

    if (curSex == maleSex) {
        defaultMaleState();
    } else if (curSex == femaleSex) {
        defaultFemaleState();
    } else {
        console.error("Incorrect gender specified for setSex");
    }
}

function defaultMaleState() {
    // TODO Set in JSON
    setBodyByName("male_body_1_head_1");

    updateDebugDisplay();
}

function defaultFemaleState() {
    // TODO Set in JSON
    setBodyByName("female_body_1_head_1");

    updateDebugDisplay();
}

function defaultItems() {
    if (curSex == maleSex) {
        // TODO Set in JSON
        setItemByName("male_shirt_1");
        setItemByName("male_pants_1");
        setSkinByName("male_skin_1");
    } else if (curSex == femaleSex) {
        // TODO Set in JSON
        setItemByName("female_shirt_1");
        setItemByName("female_pants_1");
        setSkinByName("female_skin_1");
    } else {
        console.error("Incorrect gender specified for defaultState");
    }
}

function setBodyByNumbers() {
    let body_name = `${curSex}_body_${curBodyNumber}_head_${curHeadNumber}`;
    setBodyByName(body_name);
}

function setBodyByBodyNumber(body_number) {
    curBodyNumber = body_number;
    setBodyByNumbers();
}

function setBodyByHeadNumber(head_number) {
    curHeadNumber = head_number;
    setBodyByNumbers();
}

function setBodyByName(body_name) {
    removeAllItems();

    let found = false;

    scene.traverse(function (object) {
        if (object.userData.category == bodyCategory) {
            if (object.userData.name == body_name) {
                object.visible = true;
                selectedBodyName = body_name;
                found = true;
            } else {
                object.visible = false;
            }
        }
    });

    if (found == false) {
        console.warn(`setBodyByName - unable to find body ${body_name}`);
    }

    defaultItems();

    updateDebugDisplay();
}

function removeAllItems() {
    scene.traverse(function (object) {
        if (object.userData.category == itemCategory) {
            object.visible = false;
        }
    });
}

function remItemByName(item_name) {
    let found = false;

    scene.traverse(function (object) {
        if (object.userData.category == itemCategory) {
            if (object.userData.name == item_name && object.userData.body_name == selectedBodyName) {
                found = true;
                object.visible = false;
            }
        }
    });

    if (found == false) {
        console.warn(`remItemByName - unable to find item ${item_name}`);
    }

    checkCompleteness();
}

function setItemByName(item_name) {
    let item_object;
    scene.traverse(function (object) {
        if (object.userData.category == itemCategory) {
            if (object.userData.name == item_name && object.userData.body_name == selectedBodyName) {
                item_object = object;
            }
        }
    });

    if (item_object == undefined) {
        console.warn(`setItemByName - unable to find item ${item_name}`);
        return;
    }

    scene.traverse(function (object) {
        if (object.userData.category == itemCategory) {
            if (object.userData.location == item_object.userData.location) {
                object.visible = false;
            }

            if (object.userData.name == item_name && object.userData.body_name == selectedBodyName) {
                object.visible = true;
            }
        }
    });

    checkCompleteness();

    updateDebugDisplay();
}

function remItemByLocation(item_location) {
    let found = false;

    scene.traverse(function (object) {
        if (object.userData.category == itemCategory) {
            if (object.userData.location == item_location) {
                found = true;
                object.visible = false;
            }
        }
    });

    if (found == false) {
        console.warn(`remItemByLocation - unable to find location ${item_location}`);
    }

    checkCompleteness();

    updateDebugDisplay();
}

function setSkinByName(skin_name) {
    let lower = skinTextureMap.get(skin_name).lower;
    let upper = skinTextureMap.get(skin_name).upper;
    let head = skinTextureMap.get(skin_name).head;
    let inv_data = skinTextureMap.get(skin_name).inv_data;

    if (lower != undefined && upper != undefined && head != undefined) {
        scene.traverse(function (object) {
            if (object.userData.name == selectedBodyName) {
                object.traverse(function (body_object) {
                    if (body_object.isMesh) {

                        if (body_object.material.name == "Legs.001" || body_object.material.name == "Bottom") {
                            body_object.material.map = lower;
                            body_object.material.map.flipY = false;
                            body_object.material.map.encoding = THREE.sRGBEncoding;

                            // TODO: Note here that inv_data and name is same for all 3 skins
                            // in a body but we only need to save 1 copy and a body requires
                            // all 3 textures to be present
                            body_object.material.userData.inv_data = inv_data;
                            body_object.material.userData.name = skin_name;
                        }
                        if (body_object.material.name == "Torso.001" || body_object.material.name == "Top") {
                            body_object.material.map = upper;
                            body_object.material.map.flipY = false;
                            body_object.material.map.encoding = THREE.sRGBEncoding;
                        }
                        if (body_object.material.name == "head") {
                            body_object.material.map = head;
                            body_object.material.map.flipY = false;
                            body_object.material.map.encoding = THREE.sRGBEncoding;
                        }
                    }
                });
            }
        });

        updateDebugDisplay();
    } else {
        console.warn(`setSkinByName: ${skin_name} is missing a texture`);
    }
}

function checkCompleteness() {
    let body_selected = false;
    let item_lower_selected = false;
    let item_upper_selected = false;

    scene.traverse(function (object) {
        if (object.userData.category != undefined) {
            if (object.userData.category == bodyCategory) {
                if (object.visible) {
                    body_selected = true;
                }
            }
            if (object.userData.category == itemCategory) {
                if (object.visible) {
                    if (object.userData.location == lowerLocation) {
                        item_lower_selected = true;
                    }
                    if (object.userData.location == upperLocation) {
                        item_upper_selected = true;
                    }
                }
            }
        }
    });

    if (body_selected && item_lower_selected && item_upper_selected) {
        document.getElementById("continue").style.visibility = "visible";
    } else {
        document.getElementById("continue").style.visibility = "hidden";
    }
}

function publishInvData() {
    let inv_paths = [];

    scene.traverse(function (object) {
        if (object.userData.category != undefined) {
            if (object.userData.category == bodyCategory) {
                if (object.visible) {
                    inv_paths.push(object.userData.inv_data);

                    object.traverse(function (body_object) {
                        if (body_object.isMesh) {
                            if (body_object.material.userData.inv_data != undefined) {
                                inv_paths.push(body_object.material.userData.inv_data);
                            }
                        }
                    });
                }
            }
            if (object.userData.category == itemCategory) {
                if (object.visible) {
                    inv_paths.push(object.userData.inv_data);
                }
            }
        }
    });

    let json_data = JSON.stringify(inv_paths);

    console.log("JSON data representing the selected items:", json_data);
}

function initWebGL(loaded_data) {
    console.log(`three.js: ${THREE.REVISION}`);

    const container = document.getElementById("container");

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 10);
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

    updateDebugDisplay();
}

function startApp() {
    loadConfig(configFilename).then((config_data) => {
        console.log("Loaded configuration data:", config_data);

        let default_body_name = "male_body_1_head_1"; // todo: get from JSON
        loadBodyandItems(config_data, default_body_name)
            .then((loaded_data) => {
                //console.log(`Loaded all data for ${default_body_name}`);
                initWebGL(config_data);
                addToScene(loaded_data);

                setSex(maleSex);

                // comment here and do not call it a map
                let loadMap = [];
                config_data.bodies.forEach(function (body) {
                    if (body.name != default_body_name) {
                        loadMap.push(body.name);
                    }
                });

                //console.log(`Default state set - now load rest of ${loadMap.length} items`);

                document.getElementById("loading").style.visibility = "visible";

                config_data.bodies.forEach(function (body) {
                    if (body.name != default_body_name) {
                        //console.log("Background loading rest of bodies: ", body);

                        loadBodyandItems(config_data, body.name)
                            .then((loaded_data) => {
                                //console.log(`Loaded all data for ${default_body_name}`);
                                addToScene(loaded_data);

                                // TODO: Add a comment about this and why it's not really needed
                                // it filters out loaded item from list so we can test when 0 entries
                                loadMap = loadMap.filter((e) => e !== body.name);
                                if (loadMap.length == 0) {
                                    document.getElementById("loading").style.visibility = "hidden";
                                    document.getElementById("controls").style.visibility = "visible";
                                }
                            })
                            .catch((err) => {
                                console.error(err);
                            });
                    }
                });
            })
            .catch((err) => {
                console.error(err);
            });
    });
}

startApp();
