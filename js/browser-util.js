"use strict";

var $ = require('jquery')
var log = require('./log.js')

exports.faIcon = function(clz) {
    return $("<i/>").addClass("fa").addClass(clz).addClass("fa-fw").attr("aria-hidden", "true");
}

exports.faIconDom = function(clz) {
    return exports.faIcon(clz)[0];
}

exports.button = function(text, icon) {
    var btn = $("<a/>").addClass("a_button")
    if(icon) {
        $("<div/>").addClass("button_icon").append(exports.faIcon(icon)).appendTo(btn)
    }
    if(text) {
        $("<div/>").addClass("button_label").text(text).appendTo(btn)
    }
    btn.attr("href", "");
    return btn;
}

exports.headingDom = function(which, text, icon) {
    var element = document.createElement(which)
    if(text) {
        var node = document.createElement("div")
        node.classList.add("header_text")
        node.textContent = text
        element.appendChild(node)
    }
    if(icon) {
        var node = document.createElement("div")
        node.classList.add("header_icon")
        node.appendChild(exports.faIconDom(icon))
        element.appendChild(node)
    }
    return element;
}

exports.disableButton = function(button) {
    button.removeAttr('href')
}

exports.enableButton = function(button) {
    button.attr('href', "");
}

exports.setLinkEnabled = function(button, state) {
    if(state) {
        exports.enableButton(button);
    } else {
        exports.disableButton(button);
    }
}


exports.isMobile = function() {
    /* width is set to quite distinct values, because I'm a bit afraid of different
     * device pixel ratios */

    return $("#mobile_view_detector").width() < 10;
}

exports.checkPrerequisities = function() {
    var problems = []

    if(!window.crypto.subtle) {
        problems.push("Missing cryptography support in browser");
    }
    if(typeof Promise === "undefined") {
        problems.push("Promise API");
    }

    return problems;
}

