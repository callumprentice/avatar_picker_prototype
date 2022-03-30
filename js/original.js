
// TODO: comment why this is required
window.setSex = setSex;
window.setItemByName = setItemByName;
window.remItemByLocation = remItemByLocation;
window.setBodyByBodyNumber = setBodyByBodyNumber;
window.setBodyByHeadNumber = setBodyByHeadNumber;
window.setSkinByName = setSkinByName;
window.publishInvData = publishInvData;

import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';
import { GLTFLoader } from './GLTFLoader.js';
import * as SkeletonUtils from './SkeletonUtils.js';

const configFilename = 'data.json';
let scene, renderer, camera;
let clock = new THREE.Clock();
let animationMixers = [];
const manager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(manager);
const textureLoader = new THREE.TextureLoader(manager);
let skinTextureMap = new Map();
let selectedBodyName;
let curSex = 'male';
let curBodyNumber = '1';
let curHeadNumber = '1';

manager.onStart = function (url, itemsLoaded, itemsTotal) {
    //console.log('Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
    showDiv('loading_overlay', true);
};
manager.onLoad = function () {
    //console.log('Loading complete');
    showDiv('loading_overlay', false);
};

manager.onProgress = function (url, itemsLoaded, itemsTotal) {
    let percent_loaded = parseInt((itemsLoaded * 100) / itemsTotal);
    var elem = document.getElementById('load-percent');
    if (elem != undefined) {
        elem.innerHTML = `${percent_loaded}%`;
    }
};

manager.onError = function (url) {
    console.error('There was an error loading ' + url);
    showDiv('loading_overlay', false);
};

function showDiv(div_id, show) {
    var elem = document.getElementById(div_id);
    if (elem != undefined) {
        if (show) {
            elem.style.display = 'flex';
        } else {
            elem.style.display = 'none';
        }
    }
}

function setSkinByName(skin_name) {
    // console.log(`Setting skin by name to "${skin_name}"`);

    let lower = skinTextureMap.get(skin_name).lower;
    let upper = skinTextureMap.get(skin_name).upper;
    let head = skinTextureMap.get(skin_name).head;
    let inv_data = skinTextureMap.get(skin_name).inv_data;

    if (lower != undefined && upper != undefined) {
        scene.traverse(function (object) {
            if (object.userData.name == selectedBodyName) {
                object.traverse(function (body_object) {
                    if (body_object.isMesh) {
                        if (body_object.material.name == 'lower') {
                            //console.log('Replacing texture on', body_object.material.name);
                            body_object.material.map = lower;
                            body_object.material.map.flipY = false;
                            body_object.material.map.encoding = THREE.sRGBEncoding;

                            // TODO: Note here that inv data is same for all 3 skins in a
                            // a body but we only need to save 1 copy and a body requires
                            // all 3 textures to be present
                            body_object.material.userData.inv_data = inv_data;
                        }
                        if (body_object.material.name == 'upper') {
                            //console.log('Replacing texture on', body_object.material.name);
                            body_object.material.map = upper;
                            body_object.material.map.flipY = false;
                            body_object.material.map.encoding = THREE.sRGBEncoding;
                        }
                        if (body_object.material.name == 'head') {
                            //console.log('Replacing texture on', body_object.material.name);
                            body_object.material.map = head;
                            body_object.material.map.flipY = false;
                            body_object.material.map.encoding = THREE.sRGBEncoding;
                        }
                    }
                });
            }
        });
    } else {
        console.warn(`setSkinByName: ${skin_name} is missing a texture`);
    }
}

function setSex(sex) {
    if (sex == curSex) {
        //console.log(`Sex is already ${sex}`);
        return;
    }

    curSex = sex;
}

function removeAllItems() {
    scene.traverse(function (object) {
        if (object.userData.category == 'items') {
            object.visible = false;
        }
    });
}

function defaultMaleState() {
    //console.log('Setting default male state');

    setSex('male');

    removeAllItems();

    setBodyByName('male_body_1_head_1');

    setItemByName('male_shirt_1');
    setItemByName('male_pants_1');

    setSkinByName('male_skin_1');
}

function defaultFemaleState() {
    //console.log('Setting default female state');

    setSex('female');

    removeAllItems();

    setBodyByName('female_body_1');

    setItemByName('female_shirt_1');
    setItemByName('female_pants_1');

    setSkinByName('female_skin_1');
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

function setBodyByNumbers() {
    let body_name = `${curSex}_body_${curBodyNumber}_head_${curHeadNumber}`;
    //console.log('setBodyByNumbers:', body_name);
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

function setItemByName(item_name) {
    //console.log('setting item by name to ', item_name);
    let item_object = null;
    scene.traverse(function (object) {
        if (object.userData.category == 'items') {
            if (object.userData.name == item_name) {
                item_object = object;
            }
        }
    });

    scene.traverse(function (object) {
        if (object.userData.category == 'items' || object.userData.category == 'head') {
            if (object.userData.name == item_name) {
                object.visible = true;
            } else {
                if (object.userData.location == item_object.userData.location) {
                    object.visible = false;
                }
            }
        }
    });
}

function remItemByName(item_name) {
    scene.traverse(function (object) {
        if (object.userData.category == 'items') {
            if (object.userData.name == item_name) {
                object.visible = false;
            }
        }
    });
}

function remItemByLocation(item_location) {
    scene.traverse(function (object) {
        if (object.userData.category == 'items') {
            if (object.userData.location == item_location) {
                object.visible = false;
            }
        }
    });
}

function publishInvData() {
    let inv_paths = [];
    scene.traverseVisible(function (object) {
        if (object.userData.category == 'body') {
            inv_paths.push(object.userData.inv_data);

            // TODO: comment - now look for userdata in texture
            object.traverse(function (body_object) {
                if (body_object.isMesh) {
                    if (body_object.material.userData.inv_data != undefined) {
                        inv_paths.push(body_object.material.userData.inv_data);
                    }
                }
            });
        }
        if (object.userData.category == 'items') {
            inv_paths.push(object.userData.inv_data);
        }
    });

    let json_data = JSON.stringify(inv_paths);

    console.log('JSON data representing the selected items:', json_data);

    return json_data;
}

async function loadConfig(filename) {
    let response = await fetch(filename);
    let data = await response.json();
    return data;
}

const loadAsync = (loader, url, name, location, inv_data) => {
    // console.log('loadAsync: ', url, name);
    return new Promise((resolve) => {
        loader.load(url, (payload) => {
            resolve({ name: name, location: location, payload: payload, inv_data: inv_data });
        });
    });
};

async function loadResources(skin_textures, body_gltfs, item_gltfs) {
    let loaders = [];

    skin_textures.forEach(function (each) {
        loaders.push(loadAsync(textureLoader, each.lower, each.name, 'lower', each.inv_data));
        loaders.push(loadAsync(textureLoader, each.upper, each.name, 'upper', each.inv_data));
        loaders.push(loadAsync(textureLoader, each.head, each.name, 'head', each.inv_data));
    });

    body_gltfs.forEach(function (each) {
        loaders.push(loadAsync(gltfLoader, each.filename, each.name, '', each.inv_data));
    });

    item_gltfs.forEach(function (each) {
        loaders.push(loadAsync(gltfLoader, each.filename, each.name, each.location, each.inv_data));
    });

    return await Promise.all(loaders);
}

function preLoadEverything() {
    loadConfig(configFilename).then((config_data) => {
        let body_gltfs = [];
        let item_gltfs = [];
        let skin_textures = [];

        config_data.bodies.forEach(function (body) {
            body_gltfs.push(body);
        });

        config_data.items.forEach(function (item) {
            item_gltfs.push(item);
        });

        config_data.skins.forEach(function (skin) {
            skin_textures.push(skin);
        });

        loadResources(skin_textures, body_gltfs, item_gltfs)
            .then((data) => {
                config_data.skins.forEach(function (skin) {
                    let lower_texture;
                    let upper_texture;
                    let head_texture;
                    let inv_data;
                    data.every(function (result, index) {
                        if (result.name == skin.name) {
                            if (result.location == 'lower') {
                                lower_texture = result.payload;
                            }
                            if (result.location == 'upper') {
                                upper_texture = result.payload;
                            }
                            if (result.location == 'head') {
                                head_texture = result.payload;
                            }

                            inv_data = result.inv_data;
                        }

                        return true;
                    });

                    if (lower_texture != undefined && upper_texture != undefined && head_texture != undefined) {
                        skinTextureMap.set(skin.name, {
                            lower: lower_texture,
                            upper: upper_texture,
                            head: head_texture,
                            inv_data: inv_data,
                        });
                        // console.warn('SKIN ------>>> ', inv_data);
                    } else {
                        console.warn(`Missing textures for ${skin.name}`);
                    }
                });

                // TODO: comment here - loading bodies and then items
                config_data.bodies.forEach(function (body) {
                    let animation_object_group;
                    let animation_mixer;
                    let animation_clip;

                    data.every(function (result, index) {
                        if (result.name == body.name) {
                            let body_gltf = result.payload;
                            let body_model = SkeletonUtils.clone(body_gltf.scene);

                            body_model.visible = false;
                            body_model.userData.name = body.name;
                            body_model.userData.category = body.category;
                            body_model.userData.inv_data = result.inv_data;
                            //console.warn('BODY ------>>> ', body_model.userData.inv_data);

                            animation_object_group = new THREE.AnimationObjectGroup(body_model);
                            animation_mixer = new THREE.AnimationMixer(animation_object_group);

                            if (body_gltf.animations.length > 0) {
                                animation_clip = body_gltf.animations[0];
                                animation_mixer.clipAction(animation_clip).play();
                            } else {
                                console.error(`There is no animation present for body: ${body.name}`);
                            }

                            body.items.forEach(function (body_item) {

                                data.every(function (result_item, index) {
                                    if (result_item.name == body_item) {

                                        // TODO: do not make copies of the item if the item is already in the scene
                                        let item_already_present = false;
                                        // TODO: note this never breaks on find but that's likely okay
                                        scene.traverse(function (object) {
                                            if (object.userData.name == body_item) {
                                                item_already_present = true;
                                            }
                                        });

                                        if (item_already_present == false) {
                                            let item_gltf = result_item.payload;
                                            let item_model = SkeletonUtils.clone(item_gltf.scene);

                                            item_model.visible = false;

                                            config_data.items.every(function (item_json) {
                                                if (item_json.name == body_item) {
                                                    item_model.userData.name = body_item;
                                                    item_model.userData.category = item_json.category;
                                                    item_model.userData.location = item_json.location;
                                                    item_model.userData.inv_data = result_item.inv_data;
                                                    //console.warn('ITEM ------>>> ', item_model.userData.inv_data);

                                                    return false;
                                                }
                                                return true;
                                            });

                                            animation_object_group.add(item_model);

                                            scene.add(item_model);
                                        }
                                        return false;
                                    }
                                    return true;
                                });
                            });

                            animationMixers.push(animation_mixer);

                            scene.add(body_model);

                            // break out of every(=>) loop
                            return false;
                        }

                        // continue to next iteration of every(=>) loop
                        return true;
                    });
                });

                defaultMaleState();
            })
            .catch((err) => {
                console.error(err);
            });
    });
}

function init() {
    console.log(`three.js: ${THREE.REVISION}`);

    const container = document.getElementById('container');

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
    const floor_material = new THREE.MeshPhongMaterial({ color: 0x666699, depthWrite: false });
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
        'resize',
        function () {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        },
        false
    );

    preLoadEverything();
}