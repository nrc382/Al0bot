/*
    Su database relazionale: 
        UTENTI: USER_ID , REG_DATE, LAST_MSG, ALIAS, GENDER, ROLE, SCONES, B_POINT, HAS_PENDING, CURR_ACTIVITY, LAST_ACTIVITY
        INCARICHI: ID, TITOLO(?), DIFFICULTY, AUTHOR_ID
        
    Su json in Sources/Incarichi/...
    TODO: portare da qui i metodi per user e mob da LegaModel.js
*/ 

const mysql = require('mysql');
const config = require('../models/config');
const fs = require('fs');
const path = require("path");

const db_model = require("./db_model");


// Accessorie
const submit_dir = config.submit_dir;
const users_dir = config.users_dir;

const simple_log = true;


let all_items = {base: [], creabili: []};
module.exports.all_items = all_items;

loadItems().then(function (loaded){
    if (loaded == false){
        db_model.myLog("> Errore caricando gli oggetti delle Avventure :(");

    } else{
        db_model.myLog("> caricati gli oggetti per le Avventure ("+loaded.base.length+loaded.creabili.length+")");
    }
})



function create_table(string, struct, connection) {
    return new Promise(function (create_resolve) {
        return connection.query("CREATE TABLE " + string + struct + " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
            function (err, res) {
                if (res) {
                    db_model.myLog(">\t\t> Creata la tabella: " + string);
                    return create_resolve(true);
                } else {
                    db_model.myLog(">\t\t> Errore creando la tabella: " + string);
                    console.error(err);
                    return create_resolve(false);
                }
            });
    });
}

// TODO: Sarebbe d portare fuori... (è l'unico motivo per cui questo modulo carica mysql)
function recreateAllTablesStruct() {
    return new Promise(function (local_tables_struct) {
        return db_model.pool.getConnection(function (conn_err, single_connection) {
            if (conn_err) {
                db_model.myLog("> Non sono riuscito a connettermi al database...\n");
                let tmp_connection = mysql.createConnection({
                    host: config.databaseHost,
                    user: config.databaseLootUser,
                    password: config.databasePsw
                });
                return tmp_connection.connect(function (connection_error) {
                    if (connection_error) {
                        console.error("> Nope... non sono riuscito neanche a creare il DB");
                        console.error(connection_error);
                        return local_tables_struct(false);
                    } else {
                        db_model.myLog("> Connesso all'istanza mysql, (ri)creo il DB...");
                        return tmp_connection.query("CREATE DATABASE " + config.databaseIncarichi, function (err, result) {
                            tmp_connection.release();
                            if (err) {
                                return local_tables_struct(false);
                            }
                            db_model.myLog("> Database Creato, ricomincio!");
                            return local_tables_struct(recreateAllTablesStruct());

                        });
                    }
                })
            } else if (single_connection) {
                let main_dir = path.dirname(require.main.filename);
                main_dir = path.join(main_dir, "./controllers/Incarichi/Sources/IncarichiTablesStruct.json");
                db_model.myLog("> Path per il source.json: " + main_dir);
                return fs.access(main_dir, fs.F_OK, function (err) {
                    if (err) {
                        console.error("> Non ho trovato il file!!\n");
                        console.error(err);
                        return local_tables_struct(false);
                    } else {
                        db_model.myLog("> Creo le tabelle nel database " + config.databaseIncarichi);
                        db_model.myLog(db_model.tables_names);
                        let rawdata = fs.readFileSync(main_dir);
                        let tables_structs = JSON.parse(rawdata);
                        let recreate = [];
                        recreate.push(create_table(db_model.tables_names.users, tables_structs.usrs, single_connection));
                        recreate.push(create_table(db_model.tables_names.incarichi, tables_structs.incarichi, single_connection));

                        return Promise.all(recreate).then(function (create_res) {
                            //db_model.pool.releaseConnection(single_connection);
                            single_connection.release();

                            if (create_res) {
                                db_model.myLog("> Ricreate tutte le tabelle senza Errori");
                                return local_tables_struct(true);
                            } else {
                                console.error("> Errore nella creazione delle tabelle");
                                return local_tables_struct(false);
                            }
                        });
                    }
                });
            }
        });
    });
}

function loadItems() {
    return new Promise(function (loaded_items) {
        let main_dir = path.dirname(require.main.filename);
        main_dir = path.join(main_dir, "./controllers/Incarichi/Sources/Items.json");
        db_model.myLog("> Path per Items.json: " + main_dir);
        return fs.access(main_dir, fs.F_OK, function (err) {
            if (err) {
                console.error("> Non ho trovato il file!!\n");
                console.error(err);
                return loaded_items(false);
            } else {
                return fs.readFile(main_dir, 'utf8', function (err2, rawdata) {
                    if (err) {
                        console.error(err2);
                        return loaded_items(false);
                    } else {
                        let loaded = JSON.parse(rawdata);

                        all_items.base = loaded.base;
                        all_items.creabili = loaded.creabili;
                        return loaded_items(loaded);
                    }
                });

            }
        });
    });
}


function dealError(code, msg) {
    return ("*Woops...*\n_codice: " + code + "_\n\n" + msg + "\nSe riesci, contatta @nrc382");
}

function intIn(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //max è escluso, min incluso
}

// ***********************************************
module.exports.User = class User {
    constructor(rawdata, personals) {
        this.id = rawdata.USER_ID;
        this.reg_date = rawdata.REG_DATE;
        this.alias = rawdata.ALIAS;
        this.gender = rawdata.GENDER;
        this.role = rawdata.ROLE;
        this.scones = rawdata.SCONES;
        //this.tmp_text = rawdata.TMP_TEXT;
        this.b_point = rawdata.B_POINT;
        this.has_pending = rawdata.HAS_PENDING;
        this.curr_activity = rawdata.CURR_ACTIVITY;
        this.last_actuvity = rawdata.LAST_ACTIVITY;
        this.last_interaction = rawdata.LAST_INTERACTION;


        if ((personals instanceof Array)) {
            this.personals = personals;
        } else {
            this.personals = [];
        }
    }
}

class Choice { //[{ id, delay, type, title_text}]
    constructor(rawdata) {
        this.id = rawdata.id;
        this.delay = rawdata.delay;
        this.availability = rawdata.availability; // ("ALL", "DAY", "NIGHT") // ...long (:
        this.esit_type = rawdata.esit_type; // (0, -1, 1) = (continua, fine negativa, fine positiva)
        this.title_text = rawdata.title_text;
    }
}

function getUserDBInfos(user_id) {
    return new Promise(function (getUserInfos_res) {
        return db_model.pool.query(
            "SELECT * FROM " + db_model.tables_names.users + " WHERE USER_ID = ?",
            [user_id],
            function (err, usr_infos) {
                if (err) {
                    console.error(err)
                    return getUserInfos_res(false);
                } else {
                    return getUserInfos_res(usr_infos);
                }
            });
    })
}
module.exports.getUserDBInfos = getUserDBInfos;

function newUserInfos(user_info) {
    return new Promise(function (newUserInfos) {
        let main_dir = path.dirname(require.main.filename);
        main_dir = path.join(main_dir, "./" + users_dir + user_info.id + ""); // "/struct.json"

        return fs.mkdir(main_dir, 0o766, function (error_create) {
            if (error_create && error_create.code != "EEXIST") {
                console.error("> Errore creando il file: " + main_dir);
                console.error(error_create);
                return newUserInfos({ esit: false, text: dealError(" GUI:1", "Non sono riuscito a creare i files necessari...") });
            } else {
                main_dir = path.join(main_dir, "/MainInfos.json"); // 
                let template = {
                    state: "",
                    agility: 0,
                    strength: 0,
                    cleverness: 0,
                    equip: [], // {item_id, quantity}
                    bag_type: 1,
                    bag: [], // {item_id, quantity}
                    storage: -1, // Nessuno, altrimenti un array

                    // ADVENTIURES
                    // curr_adventure: {adv_id: }, // {adv_id, paragraph}
                    // done_adventures: 0

                    // storage: [], // {item_id, quantity}
                    // spent_scones: 0,
                    // unlocked_items: [], // {item_id}
                    // curr_adventure: {}, // {adv_id, paragraph}
                    // done_adventures: [] // {adv_id, times, total_h...}

                };
                let data = JSON.stringify(template, null, 2);
                return fs.writeFile(main_dir, data, function (write_error) {
                    if (write_error) {
                        console.error("> Errore d'accesso al file: " + main_dir);
                        console.error(write_error);
                        return newUserInfos({ esit: false, text: dealError(" GUI:2", "Non sono riuscito a creare i files necessari...") });
                    }
                    return newUserInfos({ esit: true, main_infos: template });
                });
            }
        });
    });
}

function updateUserInfos(user_id, new_infos) {
    return new Promise(function (updateUserInfos_res) {
        let main_dir = path.dirname(require.main.filename);
        main_dir = path.join(main_dir, "./" + users_dir + user_id + "/MainInfos.json"); // "/struct.json"

        return fs.writeFile(main_dir, JSON.stringify(new_infos, null, 2), function (error) {
            if (error) {
                console.error("> Errore d'accesso al file: " + main_dir);
                console.error(error);
                return updateUserInfos_res({ esit: false, text: dealError(" UUI:1", "Non sono riuscito a modificare i files necessari...") });
            } else {
                db_model.myLog("> Modificate le main info di: " + user_id)
                return updateUserInfos_res({ esit: true, main_infos: new_infos });
            }
        });
    });

}
module.exports.updateUserInfos = updateUserInfos;

function getUserStorage(user_id) {
    return new Promise(function (userStorage_res) {
        let main_dir = path.dirname(require.main.filename);
        main_dir = path.join(main_dir, `./${users_dir}${user_id}/Storage.json`);

        return fs.access(main_dir, fs.F_OK, function (err) {
            if (err) {
                if (err.code == "ENOENT") {
                    main_dir = path.dirname(require.main.filename);
                    main_dir = path.join(main_dir, `./"${users_dir}${user_id}`); 

                    return fs.mkdir(main_dir, 0o766, function (error_create) {
                        if (error_create && error_create.code != "EEXIST") {
                            console.error("> Errore creando il file: " + main_dir);
                            console.error(error_create);
                            return userStorage_res({ esit: false, text: dealError(" GUS:1", "Non sono riuscito a creare i files necessari...") });
                        } else {
                            return userStorage_res({ esit: true, storage: {} });
                        }
                    });
                } else {
                    console.error(err);
                    return userStorage_res({ esit: false, text: dealError(" GUS:1", "Non sono riuscito a recuperare informazioni sul tuo rifugio...") });
                }

            } else {
                return fs.readFile(main_dir, 'utf8', function (err2, rawdata) {
                    if (err) {
                        console.error(err2);
                        return createParagraph_res({ esit: false, text: dealError(" GUS:2", "Non sono riuscito a leggere le informazioni sul tuo rifugio...") });
                    } else {
                        let loaded_storage = JSON.parse(rawdata);
                        return userStorage_res({esit: true, storage: loaded_storage});
                    }
                });
            }
        });
    });
}
module.exports.getUserStorage = getUserStorage;

function updateUserStorage(user_id, new_storage) {
    return new Promise(function (userStorage_update) {
        let main_dir = path.dirname(require.main.filename);
        main_dir = path.join(main_dir, `./${users_dir}${user_id}/Storage.json`);

        return fs.writeFile(main_dir, JSON.stringify(new_storage, null, 2), function (error) {
            if (error) {
                console.error("> Errore d'accesso al file: " + main_dir);
                console.error(error);
                return userStorage_update({ esit: false, text: dealError(" UUS:1", "Non sono riuscito a modificare i files necessari...") });
            } else {
                db_model.myLog("> Modificato storage: " + user_id)
                return userStorage_update({ esit: true, storage: new_storage });
            }
        });

    });
}
module.exports.updateUserStorage = updateUserStorage;

function getUserInfos(user_info) {
    return new Promise(function (userInfos_res) {
        let main_dir = path.dirname(require.main.filename);
        main_dir = path.join(main_dir, "./" + users_dir + user_info.id + "/MainInfos.json");

        return fs.access(main_dir, fs.F_OK, function (err) {
            if (err) {
                if (err.code == "ENOENT") {
                    return newUserInfos(user_info).then(function (res) {
                        if(res.esit == false){
                            return userInfos_res(res);
                        }
                        return userInfos_res(res.main_infos);

                    })
                } else {
                    console.error(err);
                    return userInfos_res({ esit: false, text: dealError(" GUTS:1", "Non sono riuscito a recuperare informazioni sulla bozza...") });
                }

            } else {
                return fs.readFile(main_dir, 'utf8', function (err2, rawdata) {
                    if (err) {
                        console.error(err2);
                        return createParagraph_res({ esit: false, text: dealError(" GUTS:2", "Non sono riuscito a leggere le informazioni sulla bozza...") });
                    } else {
                        let main_infos = JSON.parse(rawdata);
                        return userInfos_res(main_infos);
                    }
                });
            }
        });
    });
}
module.exports.getUserInfos = getUserInfos;


// # USER
module.exports.insertUser = function insertUser(user_infos) {
    return new Promise(function (insertUser_res) {
        let query = "INSERT INTO " + db_model.tables_names.users;
        query += "(USER_ID, ALIAS, REG_DATE, GENDER) ";
        query += "VALUES ? ";
        return db_model.pool.query(
            query,
            [[user_infos]],
            function (err, usr_infos) {
                if (err) {
                    console.error(err)
                    return insertUser_res({ esit: false, text: dealError(" IUG:0", "Errore inserendo i dati nel database..") });
                } else {
                    return insertUser_res(usr_infos);
                }
            });
    });
}

module.exports.checkAlias = function checkAlias(alias) {
    return new Promise(function (checkAlias_res) {
        return db_model.pool.query(
            "SELECT USER_ID FROM " + db_model.tables_names.users + " WHERE ALIAS LIKE ?",
            [alias],
            function (err, alias_res) {
                if (err) {
                    console.error(err)
                    return checkAlias_res({ esit: false, text: dealError(" SUG:1", "Errore contattando il database..") });
                } else {
                    if (alias_res.length == 0) {
                        return checkAlias_res(true);
                    } else {
                        return checkAlias_res(false);
                    }
                }
            });
    });
}

module.exports.setUserGender = function setUserGender(user_id, new_gender) {
    return new Promise(function (setUserGender_res) {

        let query = "UPDATE " + db_model.tables_names.users;
        query += " SET GENDER = ? ";
        query += " WHERE USER_ID = ?";
        return db_model.pool.query(query, [new_gender, user_id], function (err, db_res) {
            if (err) {
                console.error(err);
                return setUserGender_res({ esit: false, text: dealError(" SUG:2", "Errore aggiornando i tuoi dati nel database..") });
            } else {
                db_model.myLog("> Settato il genere (" + new_gender + ") per " + user_id)
                return setUserGender_res(true);
            }
        });
    });
}

module.exports.setUserLI = function setUserLI(user_id) {
    return new Promise(function (setUserGender_res) {
        let now_date = Date.now()/1000;
        let query = "UPDATE " + db_model.tables_names.users;
        query += " SET LAST_INTERACTION = ? ";
        query += " WHERE USER_ID = ?";
        return db_model.pool.query(query, [now_date, user_id], function (err, db_res) {
            if (err) {
                console.error(err);
                return setUserGender_res({ esit: false, text: dealError(" SUG:3", "Errore aggiornando i tuoi dati nel database..") });
            } else {
                db_model.myLog("> Settato ultima interazione (" + now_date + ") di " + user_id)
                return setUserGender_res(true);
            }
        });
    });
}

function updateUserParagraph(user_id, new_pending, noedit_bool) {
    return new Promise(function (updateUserParagraph_res) {
        if (noedit_bool == true || typeof new_pending != "string") {
            return updateUserParagraph_res(true);
        }
        let query = "UPDATE " + db_model.tables_names.users;
        query += " SET HAS_PENDING = ? ";
        query += " WHERE USER_ID = ?";
        return db_model.pool.query(query, [new_pending, user_id], function (err, db_res) {
            if (err) {
                console.error(err);
                return updateUserParagraph_res({ esit: false, text: dealError(" SUP:1", "Errore aggiornando i tuoi dati nel database..") });
            } else {
                db_model.myLog("> Settato paragrafo (" + new_pending + ") per " + user_id)
                return updateUserParagraph_res(true);
            }
        });
    });
}
module.exports.updateUserParagraph = updateUserParagraph;

// # TmpStruct (Bozza)
function editUserDaft(user_id, type, new_infos) { // type: "title", "desc", "diff", "type", "delay"
    return new Promise(function (editUserTmp_res) {
        return getUserDaft(user_id).then(function (res_tmp) {

            if (type == "TITLE") {
                res_tmp.title = new_infos;
            } else if (type == "DESC") {
                res_tmp.desc = new_infos;
            } else if (type == "diff") {
                res_tmp.diff = new_infos;
            } else if (new_infos == "SOLO" || new_infos == "MULTI") {
                res_tmp.play_type = new_infos;
            } else if (type == "DELAY") {
                res_tmp.delay = new_infos;
            } else if (type == "VIEW_TYPE") {
                res_tmp.view_type = new_infos;
            }
            return updateUserDaft(user_id, res_tmp).then(function (set_res) {
                return editUserTmp_res(set_res);
            })
        });
    });
}
module.exports.editUserDaft = editUserDaft;



// # Paragraphs (Bozza)

function standardParagraphTemplate(new_id, fixed_father_id) { // standardParagraphTemplate
    return ({
        id: new_id,
        father_id: fixed_father_id,
        esit_type: 0, // (loosing (-1), winning (1), continue (0)
        availability: "ALL", // DAY, ALL, NIGHT
        text: "",
        night_text: "",
        choices: [] // [{ id, delay, type, title_text}]
    })
}

function paragraph_IDBuilder() {
    let id = [];
    id.push(Math.ceil(Math.random() * 9));
    id.push(Math.ceil(Math.random() * 9));

    let idPossible_chars = "ABCDEFGHIJKLMNOPQRSTQVXYWZ";
    for (let i = 0; i < 2; i++) {
        id.push(idPossible_chars.charAt(intIn(0, 25)));
    }

    return id.join("");
}

module.exports.createFirstParagraph = function createFirstParagraph(user_id, inc_struct, loop_n, father_id) {
    return new Promise(function (firstParagraph_res) {
        let tmp_pId = paragraph_IDBuilder();
        if (loop_n > 9) {
            console.error(">\tTroppi tentativi, esco!");
            return firstParagraph_res({ esit: false, text: dealError(" CP:2", "Al momento non è possibile creare piu di 62.500 paragrafi...") });
        } else if (inc_struct.paragraphs_ids.indexOf(tmp_pId) >= 0) {
            return createFirstParagraph(inc_struct.paragraphs_ids, (loop_n + 1)); // ricorsiva
        } else { // Valido:
            //return temp;
            let template = standardParagraphTemplate(tmp_pId, father_id);
            template.level_deep = 0;

            let paragraph_data = JSON.stringify(template, null, 2);
            let main_dir = path.dirname(require.main.filename);
            main_dir = path.join(main_dir, "./" + submit_dir + "tmp/" + user_id + "/" + tmp_pId + ".json");

            return fs.writeFile(main_dir, paragraph_data, function (error) {
                if (error) {
                    console.error("> Errore d'accesso al file: " + main_dir);
                    console.error(error);
                    return firstParagraph_res({ esit: false, text: dealError(" CP:1", "Non sono riuscito a creare i files necessari...") });
                } else {
                    inc_struct.paragraphs_ids.push(tmp_pId); // aggiorno array di id usati
                    return updateUserDaft(user_id, inc_struct).then(function (set_res) {
                        if (set_res.esit == false) {
                            return firstParagraph_res(set_res);
                        }
                        return firstParagraph_res(template);
                    });
                }
            });
        }
    });
}

module.exports.loadAlternative = function loadAlternative(user_id, curr_paragraph_id, dest_paragraph_id) {
    return new Promise(function (loadAlternative_res) {
        if (!dest_paragraph_id || !curr_paragraph_id){
            return loadAlternative_res(false);
        } else if (curr_paragraph_id.toUpperCase() == dest_paragraph_id.toUpperCase()) {
            return loadAlternative_res(false);
        } else {
            return loadParagraph(user_id, dest_paragraph_id).then(function (to_return) {
                return loadAlternative_res(to_return);
            })
        }
    });
}

module.exports.createChoice = function createChoice(user_id, choice_text, inc_struct, loop_n, father_id, level_deep, force_availability) {
    return new Promise(function (createParagraph_res) {
        let tmp_pId = paragraph_IDBuilder();
        if (loop_n > 9) {
            console.error(">\tTroppi tentativi, esco!");
            return createParagraph_res({ esit: false, text: dealError(" CP:2", "Al momento non è possibile creare piu di 62.500 paragrafi...") });
        } else if (inc_struct.paragraphs_ids.indexOf(tmp_pId) >= 0) {
            return createChoice(user_id, choice_text, inc_struct, (loop_n + 1), father_id,  level_deep, force_availability); // ricorsiva
        } else { // Valido:
            //return temp;
            let paragraph_infos = standardParagraphTemplate(tmp_pId, father_id);
            paragraph_infos.level_deep = level_deep;
            if (force_availability != false) {
                paragraph_infos.availability = force_availability;
            }
            paragraph_infos.choice_title = choice_text;
            let paragraph_data = JSON.stringify(paragraph_infos, null, 2);
            let main_dir = path.dirname(require.main.filename);
            main_dir = path.join(main_dir, "./" + submit_dir + "tmp/" + user_id + "/" + tmp_pId + ".json");

            return fs.writeFile(main_dir, paragraph_data, function (error) {
                if (error) {
                    console.error("> Errore d'accesso al file: " + main_dir);
                    console.error(error);
                    return createParagraph_res({ esit: false, text: dealError(" CP:1", "Non sono riuscito a creare i files necessari...") });
                } else {
                    inc_struct.paragraphs_ids.push(tmp_pId); // aggiorno array di id usati
                    return updateUserDaft(user_id, inc_struct).then(function (set_res) {

                        return createParagraph_res(new Choice({
                            id: paragraph_infos.id,
                            delay: inc_struct.delay,
                            availability: paragraph_infos.availability,
                            esit_type: 0, // 0 = continua, -1 = 
                            title_text: choice_text
                        }));
                    });
                }
            });
        }
    });
}

module.exports.deleteChoice = function deleteChoice(user_id, paragraph_infos, inc_struct) {
    return new Promise(function (deleteChoice_res) {
        return loadParagraph(user_id, paragraph_infos.father_id).then(function (father_infos) {
            if (father_infos.esit == false) {
                return deleteChoice_res(father_infos);
            } else {
                for (let i = 0; i < father_infos.choices.length; i++) {
                    if (father_infos.choices[i].id == paragraph_infos.id) {
                        father_infos.choices.splice(i, 1);
                        break;
                    }
                }
                for (let i = 0; i < inc_struct.paragraphs_ids.length; i++) {
                    if (inc_struct.paragraphs_ids[i] == paragraph_infos.id) {
                        inc_struct.paragraphs_ids.splice(i, 1);
                        break;
                    }
                }


                return updateParagraph(user_id, father_infos.id, father_infos).then(function (paragraph_update_res) {
                    if (paragraph_update_res.esit == false) {
                        return deleteChoice_res(paragraph_update_res);
                    } else {
                        return updateUserDaft(user_id, inc_struct).then(function (update_res) {
                            if (update_res.esit == false) {
                                return deleteChoice_res(update_res);
                            } else {
                                let file_dir = path.dirname(require.main.filename);
                                file_dir = path.join(file_dir, "./" + submit_dir + "tmp/" + user_id + "/" + paragraph_infos.id + ".json");
                                fs.unlinkSync(file_dir);
                                return updateUserParagraph(user_id, father_infos.id, false).then(function (db_update) {
                                    if (db_update.esit == false) {
                                        return deleteChoice_res(db_update);
                                    }
                                    return deleteChoice_res(father_infos);

                                })

                            }
                        });
                    }
                });
            }
        });
    });
}

function loadParagraph(user_id, paragraph_id) {
    return new Promise(function (loadParagraph_res) {
        let main_dir = path.dirname(require.main.filename);
        main_dir = path.join(main_dir, "./" + submit_dir + "tmp/" + user_id + "/" + paragraph_id + ".json");

        return fs.access(main_dir, fs.F_OK, function (err) {
            if (err) {
                console.error("> Errore d'accesso al file: " + main_dir);
                console.error(err);
                return loadParagraph_res({ esit: false, text: dealError(" LP:1", "Non sono riuscito a caricare il paragrafo " + paragraph_id) });
            } else {
                return fs.readFile(main_dir, 'utf8', function (err2, rawdata) {
                    if (err2) {
                        console.error("> Errore d'accesso al file: " + main_dir);
                        console.error(err);
                        return loadParagraph_res({ esit: false, text: dealError(" LP:2", "Non sono riuscito a caricare il paragrafo " + paragraph_id) });
                    } else {
                        let tmp_daft = JSON.parse(rawdata);
                        if ("type" in tmp_daft) { // TO DELETE
                            tmp_daft.esit_type = tmp_daft.type;
                            delete tmp_daft.type;
                        }
                        if (tmp_daft.choices){ // TO DELETE
                            for (let i = 0; i< tmp_daft.choices.length; i++){
                                if (tmp_daft.choices[i].is_alternative == true){

                                    if (tmp_daft.choices[i].id){
                                        tmp_daft.choices[i].dest_id = tmp_daft.choices[i].id;
                                        tmp_daft.choices[i].alternative_id = i;

//                                        delete tmp_daft.choices[i].id;
                                    }
                                }

                            }
                        }

                        return loadParagraph_res(tmp_daft);
                    }
                });
            }
        });

    });
}
module.exports.loadParagraph = loadParagraph;

function updateParagraph(user_id, paragraph_id, new_data) {
    return new Promise(function (updateParagraph_res) {
        if ("type" in new_data) {
            //tmp_daft.esit_type = tmp_daft.type;
            delete new_data.type;
        }
        let main_dir = path.dirname(require.main.filename);
        main_dir = path.join(main_dir, "./" + submit_dir + "tmp/" + user_id + "/" + paragraph_id + ".json");
        return fs.writeFile(main_dir, JSON.stringify(new_data, null, 2), function (error) {
            if (error) {
                console.error("> Errore d'accesso al file: " + main_dir);
                console.error(error);
                return updateParagraph_res({ esit: false, text: dealError(" SUT:1", "Non sono riuscito a modificare i files necessari...") });
            } else {
                db_model.myLog("> Modificata l'avventura di: " + user_id+", paragrafo "+paragraph_id)
                return updateParagraph_res({ esit: true, struct: new_data });
            }
        });
    });
}
module.exports.updateParagraph = updateParagraph;

// # Incarichi (Paragraphs + Struct)

module.exports.getInfos = function getInfos(user_id) { // infos basiche: select * su Incarichi e User(user_id)
    return new Promise(function (getInfos_res) {
        return db_model.pool.query("SELECT * FROM " + db_model.tables_names.incarichi, null, function (err, incarichi_res) {
            if (err) {
                return recreateAllTablesStruct().then(function (recreate_res) {
                    if (recreate_res == true) {
                        return getInfos_res(getInfos());
                    } else {
                        console.error(recreate_res);
                        return getInfos_res(recreate_res);
                    }
                })
            } else {
                return getUserDBInfos(user_id).then(function (userInfos_res) {
                    if (userInfos_res === false) {
                        return getInfos_res(false);
                    } else {
                        let personal_incarichi = [];
                        for (let i = 0; i < incarichi_res.length; i++) {
                            if (incarichi_res[i].AUTHOR_ID == user_id) {
                                personal_incarichi.push(incarichi_res[i]);
                            }
                        }
                        return getInfos_res({
                            incarichi: incarichi_res,
                            user_infos: ((userInfos_res instanceof Array && userInfos_res.length == 1) ? userInfos_res[0] : []),
                            personals: personal_incarichi
                        });
                    }
                });
            }
        })
    });
}

function inc_IDBuilder(yrs) {
    let id = [yrs];

    let idPossible_chars = "ABCDEFGHIJKLMNOPQRSTQVXYWZ"
    for (let i = 0; i < 3; i++) {
        id.push(idPossible_chars.charAt(intIn(0, 25)));
    }
    id.push(Math.ceil(Math.random() * 9));

    return id.join("");
}

function unique_Id(test_id, loop_n) {
    db_model.myLog(">\tGenero ID, tentativo n: " + loop_n);

    if (loop_n > 9) {
        console.error(">\tTroppi tentativi, esco!");
        return Promise.resolve(false);
    } else {
        return sugg_pool.query("SELECT * FROM " + db_model.tables_names.incarichi + " WHERE ID LIKE ?", [test_id],
            function (err, rows) {
                if (!err) {
                    let now_date = new Date(Date.now());
                    let yrs = now_date.getFullYear().toString().substring(2);

                    db_model.myLog(">\tID DUPLICATO (sfiga?): " + test_id);
                    return unique_Id(inc_IDBuilder(yrs), loop_n + 1);
                } else {
                    db_model.myLog(">\tNUOVO ID: " + test_id);
                    return test_id;
                }
            });
    }
}

module.exports.checkParagraphID = function checkParagraphID(check_id) {
    if (typeof check_id == "undefined") {
        return false;
    }
    if (check_id.length != 4) {
        return false;
    } else {
        let tocheck_id = check_id.toUpperCase();
        if (isNaN(tocheck_id.charAt(0)) || isNaN(tocheck_id.charAt(1))) {
            return false;
        } else {
            let idPossible_chars = "ABCDEFGHIJKLMNOPQRSTQVXYWZ";
            if (idPossible_chars.indexOf(tocheck_id.charAt(2)) < 0 || idPossible_chars.indexOf(tocheck_id.charAt(3)) < 0) {
                return false;
            }
            return true;
        }
    }
}

