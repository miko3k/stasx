"use strict"

var $ = require('jquery')
var browser_util = require('./browser-util')
var util = require('./util')
var state = require('./state')
var enc = require('./browser-encryption')
var Str = require('./strings')
var Popup = require('./browser-popup')
var log = require('./log')
var Icn = require('./icons')
var google = require('./browser-google')
var FileSaver = require('file-saver');

var MAX_LOCAL_FILE_SIZE = 4 * 1024 * 1024

function addTabs(popup, n) {
    popup.addTab("Local", null, (n == 0) ? undefined : "ltab")
    popup.addTab(Str.GOOGLE_DRIVE, null, (n == 1) ? undefined : "gtab")
}

function local(cb) {
    var popup = new Popup(Str.OPEN, Icn.OPEN);
    var file = $("<input/>").attr("type", "file").hide();
    popup.addCancel(Str.CLOSE, Icn.CANCEL, "cancel")
    popup.addLink(Str.CREATE_EMPTY_FILE, Icn.EMPTY_FILE, "empty")
    popup.addLink(Str.LOCAL_OPEN, Icn.UPLOAD, function() { file.click() })
    popup.addLink(Str.LOCAL_SAVE, Icn.DOWNLOAD, "download")
    popup.addBody(file)
    addTabs(popup, 0)
    popup.onAction(cb)

    function getFile() {
        return new Promise(function(resolve, reject) {
            var htmlfile = file[0];
            if(!htmlfile.files.length)
                return;

            var f = htmlfile.files[0];
            log("user selected file", f)
            var r = new FileReader();
            r.onload = (function(ev) {
                log("name: " + f.name + ", size: " + f.size + ", type: " + f.type);
                var name = f.name || "Unknown";
                var data = ev.target.result;

                if(f.size > MAX_LOCAL_FILE_SIZE) {
                    reject(Str.FILE_TOO_BIG)
                }

                resolve({
                    name: name,
                    data: data
                })
            });
            r.onabort = r.onerror = function(ev) {
                reject(Str.ERROR_OPENING_FILE)
            }
            r.readAsText(f, "utf-8");
        });
    }

    file.change(function() {
        getFile().then(function(result) {
            popup.action("file", result)
        }).catch(function(err) {
            popup.action("error", {back: 'ltab', msg: err})
        });

    });
    return popup
}

function google_drive(cb, theState) {
    var popup = new Popup(Str.OPEN, Icn.OPEN);
    var sign_in = popup.addLink("Sign in", "fa-sign-in", function() { google.signIn(); })
    var sign_out = popup.addLink("Sign out", "fa-sign-out", function() { google.signOut(); })
    var open = popup.addLink(Str.GOOGLE_OPEN, Icn.GOOGLE_OPEN, function() {
        google.pick().then(function(result) {
            popup.action("file", result)
        }).catch(function(err) {
            popup.action("error", {back: 'gtab', msg: err})
        });
    })
    var save = popup.addLink(Str.GOOGLE_SAVE, Icn.GOOGLE_SAVE, "gsave")
    var save_as = popup.addLink(Str.GOOGLE_SAVE_AS, Icn.GOOGLE_SAVE_AS, "gsaveas")
//    var connect = popup.addLink(Str.GOOGLE_INTEGRAGE, Icn.LINK, function() { google.integrateUi(); })
//    var connected = popup.addLink("Added do Drive", Icn.LINK).addClass("info_text")

    popup.addCancel(Str.CLOSE, Icn.CANCEL, "cancel")
    popup.onHide(function() { google.setStateListener(); })

    function fix(state) {
        log("google state: ", state)

        sign_in.toggle(!state.signed_in);
        sign_out.toggle(state.signed_in);
//        connect.toggle(!state.ui_integrated)
//        connected.toggle(state.ui_integrated)
        browser_util.setLinkEnabled(open, state.signed_in)
//        browser_util.setLinkEnabled(connect, state.signed_in)
        browser_util.setLinkEnabled(save, state.signed_in && theState.getGoogleId())
        browser_util.setLinkEnabled(save_as, state.signed_in)
//        connect.toggleClass('info_text', state.ui_integrated)

        if(state.auth_ready || state.auth_failed) {
            popup.enable();
        } else {
            popup.loading();
        }
    }

    google.init();

    google.setStateListener(fix);
    fix(google.getState())

    addTabs(popup, 1)
    popup.onAction(cb)
    return popup
}

function error_popup(cb, params) {
    var p = new Popup("Error", 'fa-exclamation')
    p.addText(params.msg);
    p.addSubmit(Str.CLOSE, Icn.CANCEL, "cancel")
    p.addCancel(Str.BACK, Icn.BACK, params.back)
    p.onAction(cb)
    return p
}

function newfile(cb) {
    var p = new Popup("Empty file", Icn.EMPTY_FILE)
    p.addText(Str.FILE_NAME_NEW);
    var name = p.addTextInput("passwords")
    p.addText(Str.MASTER_PASSWORD_NEW);
    var pwd = p.addFocusedPasswordInput()
    pwd.addStrengthMeter()
    p.addSubmit(Str.CREATE, Icn.OK, function() {
        var a = name.val()
        var b = pwd.val()
        // constructor adds corrent suffix automatically
        p.action("state", new state.emptyFile(a, b))
    })
    p.addCancel(Str.BACK, Icn.BACK, "ltab")
    p.onAction(cb)
    return p
}

function save_as_popup(cb, initial_name) {
    var p = new Popup("Save as", Icn.GOOGLE_SAVE_AS)
    p.addText(Str.FILE_NAME_SAVE_AS)
    var name = p.addTextInput("passwords")
    name.val(util.removeSuffix(initial_name))

    p.addSubmit(Str.SAVE, Icn.OK, function() {
        // file name will be directly used in google drive
        // therefore we must add suffix here
        p.action("gsaveas", util.addSuffix(name.val()))
    })
    p.addCancel(Str.BACK, Icn.BACK, "gtab")
    p.onAction(cb)
    return p
}

function password_entry(cb, val) {
    var p = new Popup("Empty file", Icn.EMPTY_FILE);
    var back = val.google_id ? "gtab" : "ltab"
    p.addText(Str.OPENING_FILE_NEED_PASS.replace("%", val.name))
    var pwd = p.addFocusedPasswordInput('')
    var outstate = null

    pwd.onInput(function() {
        var current_password = pwd.val()
        if(!current_password) {
            pwd.showAsNeutral()
            return
        }

        state.loadFile(enc.decrypt, val.data, val, current_password).then(function(st) {
            outstate = st
            pwd.showAsCorrect()
            p.enable()
        }).catch(function(code) {
            p.disable()
            if(code == enc.code.BAD_FORMAT) {
                var back = val.google_id ? "gtab" : "ltab"
                p.action("error", {msg: Str.BAD_FILE_FORMAT, back: back})
            } else {
                pwd.showAsBad()
            }
        })
        return false
    })

    p.addCancel(Str.BACK, Icn.BACK, back)
    p.addSubmit(Str.OPEN, Icn.OK, function() {
        p.action("state", outstate)
    })
    p.disable();
    p.onAction(cb)
    return p;
}

module.exports = function(theState, callback) {
    function serialize() {
        var serialized = theState.serialize();
        var promise;

        if(theState.getMasterPassword()) {
            promise = enc.encrypt(serialized, theState.getMasterPassword(), 16, 10000);
        } else {
            promise = Promise.resolve(serialized)
        }
        return promise;
    }

    var popup
    function act(action, val) {
        log("ACTION = " + action + ";" + val)
        switch(action) {
            case "cancel": popup.hide(); break;
            case "ltab": popup = local(act).showInstead(popup); break;
            case "gtab": popup = google_drive(act, theState).showInstead(popup); break;
            case "error": popup = error_popup(act, val).showInstead(popup); break;
            case "empty": popup = newfile(act).showInstead(popup); break;
            case "file":
                log("OPEN FILE:", val);
                state.loadFile(enc.decrypt, val.data, val, '').then(function(st) {
                    popup.action("state", st)
                }).catch(function(code) {
                    if(code == enc.code.BAD_FORMAT) {
                        var back = val.google_id ? "gtab" : "ltab"
                        popup.action("error", {msg: Str.BAD_FILE_FORMAT, back: back})
                    } else {
                        popup = password_entry(act, val).showInstead(popup)
                    }
                })
                break;

            case "state":
                log("STATE:", val);
                callback(val)
                popup.hide()
                break;

            case "download":
                serialize().then(function(res) {
                    var blob = new Blob([res], {type: "text/plain; charset=utf-8"});
                    FileSaver.saveAs(blob, theState.getFileName(), true)
                });
                break;

            case "gsave":
                serialize().then(function(serialized) {
                    google.save(theState.getGoogleId(), serialized).then(function() {
                        popup.hide();
                    }).catch(function(err) {
                        popup.action("error", { msg: err, back: "gtab" })
                    })
                })
                break;

            case "gsaveas":
                if(!val) {
                    popup = save_as_popup(act, theState.getFileName()).showInstead(popup);
                } else {
                    serialize().then(function(serialized) {
                        google.saveAs(val, serialized).then(function(id) {
                            popup.hide();
                            theState.setGoogleId(id)
                            theState.setFileName(val)
                        }).catch(function(err) {
                            log(err)
                            popup.action("error", { msg: err, back: "gtab" })
                        })
                    })
                }
                break;

        }
    }
    if(theState.getGoogleId()) {
        return (popup = google_drive(act, theState))
    } else {
        return (popup = local(act))
    }
}
