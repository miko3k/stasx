"use strict";

var $ = require('jquery')
var Clipboard = require('clipboard')

var enc = require('./browser-encryption')
var state = require('./state')
var File = require('./file').File
var Str = require('./strings')
var util = require('./util')
var Popup = require('./browser-popup')
var browser_util = require('./browser-util')
var browser_lists = require('./browser-lists')
var log = require('./log')
var Icn = require('./icons')
var dialogs = require('./browser-dialogs')
var file_dialog = require('./browser-filedialog')
var detail = require('./browser-detail')

var PRODUCT_NAME = "stasx";

var theState = new state.State(new File(), "passwords", "")
var theLastDetail = {};

function addTagPopup(eid) {
    var popup = new Popup(Str.ADD_TAG, Icn.ADD);
    var pass = theState.getEntry(eid)

    theState.forEachTag(function(tag, value) {
        var el = browser_util.button(value.getName(), Icn.TAG);

        if(pass.hasTag(tag)) {
            browser_util.disableButton(el);
        } else {
            el.click(function() {
                pass.addTag(tag);
                refreshEntryDetail(eid);
                Popup.cancelInDetail();
                return false;
            });
        }

        popup.addBody(el);
    });
    popup.addCancel(Str.CANCEL, Icn.CANCEL);
    popup.showInDetail();
}

function refreshEntryDetail(key) {
    refreshList();

    detail.setActionButtons("Delete this entry", function() { theState.deleteEntry(key); refreshList(); });

    var pass = theState.getEntry(key);

    var editorHeader = function(editor, title, dialog_title, value, setter) {
        return detail.editorHeader(
                editor,
                title,
                dialog_title,
                value,
                function(res) {
                    pass[setter](res)
                    refreshEntryDetail(key);
                });
    }

    var editorItem = function(display, value) {
        var item = display(value);
        return detail.copyableItem(item, value);
    }

    var body = $("#detail_body");
    body.empty()

    editorHeader(dialogs.inputFieldEditor, "Name", "Edit name", pass.getName(), "setName").appendTo(body);
    editorItem(detail.textDisplay, pass.getName()).appendTo(body);

    editorHeader(dialogs.inputFieldEditor, "User", "Edit user", pass.getUser(), "setUser").appendTo(body);
    editorItem(detail.textDisplay, pass.getUser()).appendTo(body);

    editorHeader(dialogs.passwordEditor,
            "Password", "Edit password", pass.getPassword(), "setPassword").appendTo(body);
    editorItem(detail.passwordDisplay, pass.getPassword()).appendTo(body);

    editorHeader(dialogs.textAreaEditor, "Remarks", "Edit remarks", pass.getRemarks(), "setRemarks").appendTo(body);
    editorItem(detail.areaDisplay, pass.getRemarks()).appendTo(body);

    var have_tag_to_add = false
    theState.forEachTag(function(tag) {
        if(!pass.hasTag(tag)) have_tag_to_add = true
    })

    var popup = (have_tag_to_add) ? addTagPopup.bind(null, key) : null

    detail.header(Str.TAGS, Str.ADD, Icn.ADD, popup).appendTo(body)

    if(!pass.hasAnyTag()) {
        detail.staticItem(Str.NONE).appendTo(body);
    } else {
        pass.forEachTag(function(tag) {
            var action = function() {
                pass.removeTag(tag);
                refreshEntryDetail(key);
            };
            detail.removableItem(theState.getTag(tag).getName(), action).appendTo(body);
        });
    }
}

function refreshTagDetail(key) {
    refreshList();
    detail.setActionButtons("Delete this tag", function() { theState.deleteTag(key); refreshList();});

    var body = $("#detail_body");
    body.empty();

    var tag = theState.getTag(key);
    function setName(name) {
        tag.setName(name);
        refreshTagDetail(key);
    }

    var onedit = function(val) {
        tag.setName(val);
        refreshTagDetail(key);
    }

    body.empty()
    detail.editorHeader(dialogs.inputFieldEditor, "Name", "Edit tag name", tag.getName(), onedit).appendTo(body)
    detail.copyableItem(detail.textDisplay(tag.getName()), tag.getName()).appendTo(body)
}


function refreshList() {
    var taglist = $("#taglist");

    var alltags = theState.getEachTag(function(a, b) { return { tid: a, name: b.getName() }} )

    var clickTag = function(item) {
        theState.toggleTag(item.tid)
        refreshList();
    }

    browser_lists.fixTagsDom(alltags, taglist, clickTag);

    taglist.children().each(function() {
        var x = $(this);
        var h = browser_lists.readTagDom($(this))

        if(h && theState.isTagSelected(h.tid)) {
            x.addClass('selected');
        } else {
            x.removeClass('selected');
        }
    });


    var top = $("#sitelist");

    var entries = theState.getEachVisibleEntry(function(a, b) { return { eid: a, name: b.getName() }});
    var tag = theState.getOnlySelectedTag();
    var placeholder = (entries.length == 0)
    if(tag !== undefined) {
        placeholder = false;
        entries.unshift({
            "tid": tag,
            "name": theState.getTag(tag).getName()
        });
    }
    $('#sitelist_empty').toggle(placeholder);

    var clickOnItem = function(item) {
        function getVisibleDetail() {
            if(!Popup.isVisibleInDetail() && $("#detail").is(":visible"))
                return theLastDetail;
            else
                return {};
        }
        if(item.tid) {
            if(getVisibleDetail().tid === item.tid) {
                detail.hide();
            } else {
                detail.show();
                theLastDetail = { "tid": item.tid }
                refreshTagDetail(item.tid);
            }
        } else {
            if(getVisibleDetail().eid === item.eid) {
                detail.hide();
            } else {
                detail.show();
                theLastDetail = { "eid": item.eid }
                refreshEntryDetail(item.eid);
            }
        }
    }
    browser_lists.fixEntriesDom(entries, top, clickOnItem);
}

document.addEventListener('DOMContentLoaded', function () {
    var problems = browser_util.checkPrerequisities();
    if(problems.length) {
        var body = $("body").empty();
        // we wont use ul because we restyled it in unusable way!
        $("<p/>").text("This application cannot run, because your browser is missing features:").appendTo(body);

        for(var i = 0; i < problems.length; ++i) {
            $("<p/>").text(problems[i]).appendTo(body);
        }
        return;
    }


    var clipboard = new Clipboard("." + detail.COPY_BUTTON_CLASS_NAME);
    clipboard.on('success', function(e) {
        var btn = $(e.trigger);
        var box = $("<div/>").addClass("copied").append(browser_util.faIcon(Icn.DONE)).hide();
        btn.append(box);
        box.fadeIn(300).delay(800).fadeOut(300, function() { box.remove(); })
//        btn.fadeOut(300).delay(500).fadeIn(300);
    });

    window.addEventListener("keypress", function(event) {
        // IE9 uses Esc (which not not supported by rest of app anyways, but just in case)
        // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
        if(event.code == 'Escape' || event.code == 'Esc') {
            if(Popup.isVisibleModal()) {
                Popup.cancelModal();
            } else if(Popup.isVisibleInDetail()) {
                Popup.cancelInDetail();
            } else {
                detail.hide();
            }
        }
    });

    var main_menu = $("#main_menu");
    var offsetX = 180
    var offsetY = function(n) { return Math.max(n * 58 - 4, 5) }

    browser_util.button(Str.FILE, Icn.FILE).appendTo(main_menu).click(function() {
        var popup = file_dialog(theState, function(newstate) {
            detail.hide();
            theState = newstate;
            refreshList();
        });
        popup.showModal(offsetX, offsetY(0))
        return false;
    });

    browser_util.button(Str.CREATE, Icn.ADD).appendTo(main_menu).click(function() {
        var popup = new Popup(Str.CREATE, Icn.ADD);
        popup.addBody($("<p/>").text(Str.ENTER_NAME_OF_ITEM))

        var name = popup.addFocusedTextInput();

        popup.addSubmit(Str.CREATE_ENTRY, Icn.ENTRY, function() {
            theState.createEntry(name.val() || Str.UNTITLED_ENTRY);
            popup.hide()
            refreshList();
        })

        popup.addButton(Str.CREATE_TAG, Icn.TAG, function() {
            theState.createTag(name.val() || Str.UNTITLED_TAG);
            popup.hide()
            refreshList();
        })

        popup.addCancel(Str.CANCEL, Icn.CANCEL)

        popup.showModal(offsetX, offsetY(1))
        return false;
    });

    browser_util.button(Str.PROTECT, Icn.LOCK).appendTo(main_menu).click(function() {
        var popup = dialogs.changeMasterPassword(theState.getMasterPassword(), function(pwd) {
            theState.setMasterPassword(pwd);
        });
        popup.showModal(offsetX, offsetY(2))
        return false
    });


    browser_util.button(Str.ABOUT, Icn.ABOUT).appendTo(main_menu).click(function() {
        dialogs.about(PRODUCT_NAME).showModal(offsetX, offsetY(3))
        return false;
    });

    refreshList();
});
