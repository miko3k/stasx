"use strict";

var $ = require('jquery')
var Popup = require('./browser-popup.js')
var Str = require('./strings.js')
var Icn = require('./icons.js')
var browser_util = require('./browser-util.js')
var util = require('./util.js')

exports.COPY_BUTTON_CLASS_NAME = "copy_button_class"

exports.show = function() {
    Popup.ensureHiddenInDetail();
    $("#detail").show(200);
    return false;
}

exports.hide = function() {
    $("#detail").hide(200);
    return false;
}

exports.textDisplay = function(text) { return $("<span/>").text(text || Str.NONE); }
exports.passwordDisplay = function(text) { return $("<span/>").text(util.masked(text) || Str.NONE); }
exports.areaDisplay = function(text) { return $("<pre/>").text(text || Str.NONE); }

exports.setActionButtons = function(deleteText, deleteCallback) {
    var b1 = browser_util.button(Str.CLOSE, Icn.CANCEL).click(exports.hide);
    var b2 = browser_util.button(Str.DELETE, Icn.DELETE).click(function() {
        var popup = new Popup(deleteText);
        popup.addSubmit(Str.OK, Icn.OK, function() {
            deleteCallback();
            exports.hide();
        });
        popup.addCancel(Str.CANCEL, Icn.CANCEL);
        popup.showInDetail();
        return false;
    });
    $("#detail_buttons").empty().append(b2, b1);
}


module.exports.header = function(title, icon_text, icon_fa, action) {
    var edit_button = browser_util.button(icon_text, icon_fa);
    if(!action) {
        browser_util.disableButton(edit_button)
    } else {
        edit_button.click(function() {
            action();
            return false
        });
    }

    var result = $("<dt/>")
    result.append($("<span/>").addClass("detail_item").text(title));
    result.append(edit_button)

    return result;
}

module.exports.editorHeader = function(editor, title, dialog_title, dialog_value, dialog_action) {
    var onclick = function() {
        var popup = editor(dialog_title, dialog_value, dialog_action);
        popup.showInDetail();
    }

    return exports.header(title, Str.EDIT, Icn.EDIT, onclick);
}

function createItem(element, label, icon, copy_value, onclick) {
    var action_button = null;
    if(label && icon) {
        action_button = browser_util.button(label, icon);
        if(onclick) {
            if(copy_value) {
                action_button.addClass(exports.COPY_BUTTON_CLASS_NAME).attr("data-clipboard-text", copy_value);
            }

            action_button.click(onclick); // we cannot return false here, it would break clipboard!
        } else {
            browser_util.disableButton(action_button);
        }
    }

    var result = $("<dd/>")
    result.append(element.addClass("detail_item"));
    if(action_button) {
        result.append(action_button)
    }
    return result;
}

module.exports.copyableItem = function(element, value) {
    return createItem(
        element,
        Str.COPY,
        Icn.COPY,
        value,
        value ? function(e) {
            e.preventDefault();
            // just preventDefault, returning false breaks Clipboard.js
        } : null
    );
}

module.exports.removableItem = function(text, onremove) {
    return createItem(
        $("<span/>").text(text),
        Str.REMOVE,
        Icn.DELETE,
        null,
        (onremove) ? function() {
            onremove();
            return false;
        } : null
    );
}

module.exports.staticItem = function(text) {
    return createItem(
        $("<span/>").text(text)
    );
}
