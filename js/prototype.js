/**
 * @file prototype.js
 *
 * @brief Avatar Picker: Standalone Prototype
 *
 * @author Callum Prentice (callum@lindenlab.com)
 *
 * @date April 2022
 */

import * as THREE from "./three.module.js";
import { OrbitControls } from "./OrbitControls.js";
import { GLTFLoader } from "./GLTFLoader.js";
import * as SkeletonUtils from "./SkeletonUtils.js";

// expose functions here to the HTML file
window.setSex = setSex;
window.setItemByName = setItemByName;
window.remItemByName = remItemByName;
window.remItemByLocation = remItemByLocation;
window.setBodyByBodyNumber = setBodyByBodyNumber;
window.setBodyByHeadNumber = setBodyByHeadNumber;
window.setSkinByName = setSkinByName;
window.publishInvData = publishInvData;

// flag for developer mode - turns on various debugging aids
const devMode = false;

// the name of the JSON file containing data about bodies, items, skins etc.
const configFilename = "data.json";

// constants used in various place instrad of literals
const femaleSex = "female";
const maleSex = "male";
const bodyCategory = "body";
const itemCategory = "item";
const lowerLocation = "lower";
const upperLocation = "upper";
const headLocation = "head";

// variables containing current state
let selectedBodyName;
let curSex;
let curBodyNumber;
let curHeadNumber;
let defaultMaleItems;
let defaultMaleSkin;
let defaultFemaleItems;
let defaultFemaleSkin;
let skinTextureMap = new Map();

// misc three.js variables (unrealted to avatar itself)
let scene, renderer, camera;
let clock = new THREE.Clock();
let animationMixers = [];
const manager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(manager);
const textureLoader = new THREE.TextureLoader(manager);

// called when the three.js loader manager starts to download files
manager.onStart = function (url, itemsLoaded, itemsTotal) {
    if (devMode) {
        console.log(`Started loading data`);
    }
};

// called when the three.js loader manager completes downloading files
manager.onLoad = function () {
    if (devMode) {
        console.log(`Loading complete`);
    }
};

// called when the three.js loader manager indicates progres (noisy!)
manager.onProgress = function (url, itemsLoaded, itemsTotal) {
    if (devMode) {
        let percent_loaded = parseInt((itemsLoaded * 100) / itemsTotal);
        console.log(`Percent complete: ${percent_loaded}`);
    }
};

// called when the three.js loader manager encounters an error
// typically when a file cannot be loaded
manager.onError = function (url) {
    if (devMode) {
        console.error("There was an error loading " + url);
    }
};

// update the display used in dev mode that shows current
// body name, item names, skin name and more
function updateDebugDisplay() {

    // Turn off if we are not in dev mode
    // Consider removing code altogether for production
    if (devMode == false) {
        return;
    }

    showDiv("debug_display", true);

    let el = document.getElementById("debug_display");
    let debug_str = `<em>Debug Data:</em><br>`;

    // look through the three.js scenegraph and extract the
    // relevant visible items then display them
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

// load the JSON data file - returns a promise
async function loadConfig(filename) {
    let response = await fetch(filename);
    let data = await response.json();

    return data;
}

// load files using the three.js loader manager, a named loader
// then return the payload as well as other data - returns a promise
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

// returns an "Item" in the JSON config file
// using its name as a lookup
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

// returns a "Skin" in the JSON config file
// using its name as a lookup
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

// loads the body, the associated items and skins for a named body
async function loadBodyItemsSkins(config_data, name) {
    let loaders = [];

    // look through list of bodies in the JSON file for the one we want
    config_data.bodies.every(function (body) {
        if (body.name == name) {
            // load it
            loaders.push(loadAsync(gltfLoader, body.filename, body.name, body.category, "", body.inv_data));

            // look through the list of items in the JSON file for this body
            body.items.forEach(function (item) {
                let item_data = getItemByName(config_data, item);
                // load them
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

            // look through the list of skins in the JSON file for this body
            body.skins.forEach(function (skin) {
                let skin_data = getSkinByName(config_data, skin);

                // if we haven't seen this skin yet, then save it
                if (skinTextureMap.has(skin_data.name) == false) {
                    let lower_texture = textureLoader.load(skin_data.lower);
                    lower_texture.flipY = true;
                    let upper_texture = textureLoader.load(skin_data.upper);
                    upper_texture.flipY = true;
                    let head_texture = textureLoader.load(skin_data.head);
                    head_texture.flipY = true;

                    let inv_data = skin_data.inv_data;

                    // save textures for upper/lower body, head and
                    // the inventory data that will be used in the viewer
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

// Main code that adds things to the three.js scenegraph.
function addToScene(loaded_data) {

    // Look through the loaded data for a body
    let body_data;
    loaded_data.every(function (each) {
        if (each.category == bodyCategory) {
            body_data = each;
            return false;
        }
        return true;
    });

    // did not find a body here - there should always be one - bail
    if (body_data == undefined) {
        console.error(`Unable to load body and items for ${name}`);
        return;
    }

    // extract the GLTF file and create a compatible three.js
    // rigged model using SkeletonUtils
    let body_gltf = body_data.payload;
    let body_model = SkeletonUtils.clone(body_gltf.scene);

    let animation_object_group;
    let animation_mixer;
    let animation_clip;

    // create animation group and mixer for this body
    animation_object_group = new THREE.AnimationObjectGroup(body_model);
    animation_mixer = new THREE.AnimationMixer(animation_object_group);

    // "Play" the animation in the body GLTF file - one *must* be present
    if (body_gltf.animations.length > 0) {
        animation_clip = body_gltf.animations[0];
        animation_mixer.clipAction(animation_clip).play();
    } else {
        console.error(`There is no animation present for body: ${name}`);
        return;
    }

    // collect the skeleton from the body - we will use it to update
    // the skeleton of items when they are loaded later on
    let body_skeleton;
    body_model.traverse(function (object) {
        if (object.isSkinnedMesh) {
            body_skeleton = object.skeleton;
        }
    });

    // hide it, set some metadata and add to scenegraph
    body_model.visible = false;
    body_model.userData.name = body_data.name;
    body_model.userData.category = body_data.category;
    body_model.userData.inv_data = body_data.inv_data;
    scene.add(body_model);

    // look through the data that was loaded for items - same
    // kinds of things happen as for the body above (see comments there)
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

            // this is specific to items - we use the body skeleton we saved
            // earlier to update the skeleton position/scale/rotation of the
            // item skeleton - needed to make three.js do the right thing
            // with a rigged mesh
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

            // add each item to the animation group
            animation_object_group.add(item_model);

            // add it to the three.js scenegraph (hidden)
            scene.add(item_model);
        }
    });

    animationMixers.push(animation_mixer);
}

// sets the current sex of the avatar - call from HTML code when
// the sex changes - initial value is read from JSON file
function setSex(sex) {
    if (sex == curSex) {
        return;
    }

    curSex = sex;

    setBodyByComponents();
}

// adds the default items to display for each sex
// via the JSON config file
function defaultItems() {
    if (curSex == maleSex) {
        defaultMaleItems.forEach(function (each) {
            setItemByName(each);
        });
        setSkinByName(defaultMaleSkin);
    } else if (curSex == femaleSex) {
        defaultFemaleItems.forEach(function (each) {
            setItemByName(each);
        });
        setSkinByName(defaultFemaleSkin);
    } else {
        console.error("Incorrect gender specified for defaultState");
    }
}

// builds the name of a body using sex, body number and head number
function getBodyNameByComponents() {
    return `${curSex}_body_${curBodyNumber}_head_${curHeadNumber}`;
}

// set a new body based on the sex, body number and head number components
function setBodyByComponents() {
    let body_name = getBodyNameByComponents();
    setBodyByName(body_name);
}

// set a new body solely based on the body number
function setBodyByBodyNumber(body_number) {
    curBodyNumber = body_number;
    setBodyByComponents();
}

// set a new body solely based on the head number
function setBodyByHeadNumber(head_number) {
    curHeadNumber = head_number;
    setBodyByComponents();
}

// set a body directly by name.  Note - this function is called
// by many others after composing the body name from the various
// components - you most likely do not want to call this yourself
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

// remove all items from the scene
function removeAllItems() {
    scene.traverse(function (object) {
        if (object.userData.category == itemCategory) {
            object.visible = false;
        }
    });
}

// remove an item by name from the scene
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

    // check to see if the current settings are "complete" and they
    // are allowed to continue to the next step
    checkCompleteness();
}

// display an item directly using its name
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

    // check to see if the current settings are "complete" and they
    // are allowed to continue to the next step
    checkCompleteness();

    updateDebugDisplay();
}

// remove an item from the scene based on its location on the body
// such as lower or upper location
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

// set a body skin directly using its name defined in the JSON file
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
                        if (body_object.material.name == lowerLocation) {
                            body_object.material.map = lower;
                            body_object.material.map.flipY = false;
                            body_object.material.map.encoding = THREE.sRGBEncoding;

                            // Note here that inv_data and name is same for all 3 skins
                            // in a body but we only need to save 1 copy and a body requires
                            // all 3 textures to be present
                            body_object.material.userData.inv_data = inv_data;
                            body_object.material.userData.name = skin_name;
                        }
                        if (body_object.material.name == upperLocation) {
                            body_object.material.map = upper;
                            body_object.material.map.flipY = false;
                            body_object.material.map.encoding = THREE.sRGBEncoding;
                        }
                        if (body_object.material.name == headLocation) {
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

// check if the current settings are "complete" and the user
// is allowed to continue to the next stage - this may need
// more work but for example, currently the avatar needs
// a shirt and pants to proceed but other heuristics could be added
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
        let controls_visible = document.getElementById("controls").style.visibility;
        if (controls_visible == "visible") {
            showDiv("continue", true);
        }
    } else {
        showDiv("continue", false);
    }
}

// show or hide a div - used to hide/show items like loading,
// debug/dev mode and continue UI panels
function showDiv(elname, show) {
    let element = document.getElementById(elname);
    if (element != undefined) {
        if (show) {
            element.style.visibility = "visible";
        } else {
            element.style.visibility = "hidden";
        }
    }
}

// boilerplate function that builds a list of visible items then uses
// that to create a blob of JSON. Ultimately, this is what will be
// used to send data to a server to tell it what inventory data to
// copy across so the user ends up with an avatar that looks the same
// as the one they configured when they start Second Life
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

// three.js boilerplate initialztion code
function initWebGL(loaded_data) {
    if (devMode) {
        console.log(`three.js: ${THREE.REVISION}`);
    }

    const container = document.getElementById("container");

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 10);
    camera.position.set(0, 1.6, 1.2);

    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
    controls.target.set(0, 0.95, 0);
    controls.minPolarAngle = Math.PI / 6;
    controls.maxPolarAngle = (3 * Math.PI) / 4;

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

// entry point for the application - call to this at bottom of file
function startApp() {

    // load the JSON config data file
    loadConfig(configFilename).then((config_data) => {
        if (devMode) {
            console.log("Loaded configuration data:", config_data);
        }

        // pick up initial settings from JSON data file
        curSex = config_data.settings.defaultSex;
        curBodyNumber = config_data.settings.defaultBodyNumber;
        curHeadNumber = config_data.settings.defaultHeadNumber;
        defaultMaleItems = config_data.settings.defaultMaleItems;
        defaultMaleSkin = config_data.settings.defaultMaleSkin;
        defaultFemaleItems = config_data.settings.defaultFemaleItems;
        defaultFemaleSkin = config_data.settings.defaultFemaleSkin;

        // generate the default body name to look for and load first
        let default_body_name = getBodyNameByComponents();

        // load the default body and its items
        loadBodyItemsSkins(config_data, default_body_name)
            .then((loaded_data) => {

                // now we have the first body so we can initialize WebGL/three.js
                initWebGL(config_data);

                // add the body/items etc. to the newly initialized scene
                addToScene(loaded_data);

                // initial state using previously set sex, body, head components
                setBodyByComponents();

                // Build a list of bodies (other than the default) that
                // will be loaded in the background - this is an inelegant
                // way of dealing with the asynchronous nature of the promise
                // based loading when we have to know when the loading is complete.
                // (Observing the three.js Loader Manager is not sufficient)
                let bodiesToLoad = [];
                config_data.bodies.forEach(function (body) {
                    if (body.name != default_body_name) {
                        bodiesToLoad.push(body.name);
                    }
                });

                // show a simple panel to indicate we are waiting for something to load
                showDiv("loading", true);

                // load all the other bodies now that the default one is loaded
                // and the scene is interactive
                config_data.bodies.forEach(function (body) {
                    if (body.name != default_body_name) {
                        loadBodyItemsSkins(config_data, body.name)
                            .then((loaded_data) => {
                                addToScene(loaded_data);

                                // Remove the body name we just just loaded from the
                                // list and when the list is empty, switch the loading and
                                // the controls DIVs because we are ready to proceed
                                bodiesToLoad = bodiesToLoad.filter((e) => e !== body.name);
                                if (bodiesToLoad.length == 0) {
                                    showDiv("loading", false);
                                    showDiv("controls", true);
                                    checkCompleteness();
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

// kick things off
startApp();
