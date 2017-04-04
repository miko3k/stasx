"use strict"

var $ = require('jquery')
var browser_util = require('./browser-util')
var util = require('./util')
var enc = require('./browser-encryption')
var Str = require('./strings')
var Popup = require('./browser-popup')
var log = require('./log')
var Icn = require('./icons')

module.exports.about = function(name) {
    function extlink(name, link) {
        return $("<a/>").
            attr('href', link).
            attr('target', '_blank').
            text(name);
    }

    function li(name, link) {
        return $("<li/>").append(extlink(name, link));
    }


    var ul = $("<ul/>")
    li("jQuery", "https://jquery.com").appendTo(ul);
    li("Node.js", "https://nodejs.org").appendTo(ul);
    li("Grunt", "http://gruntjs.com").appendTo(ul);
    li("stylus", "http://stylus-lang.com").appendTo(ul);
    li("Font Awesome", "http://fontawesome.io").appendTo(ul);
    li("zxcvbn", "https://github.com/dropbox/zxcvbn").appendTo(ul);
    li("clipboard.js", "https://clipboardjs.com").appendTo(ul);
    li("FileSaver.js", "https://github.com/eligrey/FileSaver.js").appendTo(ul);
    li("Google Fonts", "https://fonts.google.com").appendTo(ul);

    var popup = new Popup(Str.ABOUT_SOMETHING.replace("%", name), Icn.ABOUT)

    popup.addCancel(Str.CLOSE, Icn.CANCEL)
    popup.addBody($("<p/>").addClass("centered").text(Str.ABOUT_INTRO.replace('%', name)));
    popup.addBody($("<p/>").addClass("centered").text(Str.THANKS_TO).append(ul));

    return popup
}

module.exports.changeMasterPassword = function(current, onchange) {
    var popup = new Popup(Str.SET_MASTER_PASSWORD, Icn.LOCK);

    if(current) {
        var first = $("<p/>").text(Str.MASTER_PASSWORD_ENTRY)
        var pwdold = Popup.createPasswordInput()
        var second = $("<p/>").text(Str.MASTER_PASSWORD_CHANGE).hide()
        var pwdnew = Popup.createPasswordInput()
        pwdnew.addStrengthMeter()
        pwdnew.hide()
        popup.disable()

        popup.addBody(first)
        popup.addFocusedBody(pwdold)
        popup.addBody(second)
        popup.addBody(pwdnew)

        pwdold.onInput(function() {
            if(pwdold.val() == current) {
                second.show()
                pwdnew.show()
                pwdold.showAsCorrect()
                popup.enable()
                pwdnew.focus()
            } else {
                second.hide()
                pwdnew.hide()
                pwdold.showAsBad()
                popup.disable()
            }
        });
    } else {
        popup.addBody($("<p/>").text(Str.MASTER_PASSWORD_NEW))
        var pwdnew = Popup.createPasswordInput()
        pwdnew.addStrengthMeter()
        popup.addFocusedBody(pwdnew)
    }

    popup.addSubmit(Str.OK, Icn.OK, function() { popup.hide(); onchange(pwdnew.val()) })
    popup.addCancel(Str.CANCEL, Icn.CANCEL)
    return popup;
}

module.exports.inputFieldEditor = function(title, value, on_submit) {
    var ep = new Popup(title, Icn.EDIT);
    var text = ep.addFocusedTextInput(value || '')
    ep.addSubmit(Str.OK, Icn.OK, function() { ep.hide(); on_submit(text.val()); });
    ep.addCancel(Str.CANCEL, Icn.CANCEL)
    ep.onShow(function() { text.select(); });

    return ep;
}

module.exports.passwordEditor = function(title, value, on_submit) {
    var ep = new Popup(title, Icn.EDIT);

    var pwd = Popup.createPasswordInput(value || '')
    pwd.addStrengthMeter()
    ep.addFocusedBody(pwd)
    ep.addButton(Str.GENERATE, Icn.QUESTION, function() {
        pwd.val(enc.generatePassword(20));
        pwd.select();
    });

    ep.addSubmit(Str.OK, Icn.OK, function() { ep.hide(); on_submit(pwd.val()); });
    ep.addCancel(Str.CANCEL, Icn.CANCEL)
    ep.onShow(function() { pwd.select(); });

    return ep;
}

module.exports.textAreaEditor = function(title, value, on_submit) {
    var text = $("<textarea/>").text(value || '');

    var ep = new Popup(title, Icn.EDIT);
    ep.addFocusedBody(text)
    ep.addSubmit(Str.OK, Icn.OK, function() { ep.hide(); on_submit(text.val()); });
    ep.addCancel(Str.CANCEL, Icn.CANCEL)
    ep.onShow(function() { text.select(); });

    return ep;
}
