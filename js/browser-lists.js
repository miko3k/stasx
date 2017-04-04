"use strict";

var $ = require('jquery')
var Icn = require('./icons.js')
var browser_util = require('./browser-util.js')
var log = require('./log')

var createTagDom = function(item, onclick) {
    var a = browser_util.button(item.name, Icn.TAG);

    a.click(function() {
        onclick(item)
        return false;
    });

    return $("<li/>").
        attr('id', 'tag_id_' + item.tid).
        append(a)
}

var readTagDom = function(html) {
    var id = html.attr('id').replace(/^tag_id_/, '');
    var name = html.find(".button_label").text();

    return {
        "tid": id,
        "name": name
    };
}

var createEntryDom = function(item, onclick) {

    var li = $("<li/>")

    if(item.tid) {
        var a = browser_util.button(item.name || '', Icn.TAG)
        a.click(function() {
            onclick(item)
            return false;
        });
        return li.attr('id', 'tag_entry_id_' + item.tid).addClass("tag").append(a);
    } else {
        var a = browser_util.button(item.name || '', Icn.ENTRY)
        a.click(function() {
            onclick(item)
            return false;
        });

        return li.attr('id', 'entry_id_' + item.eid).append(a);
    }
}

var readEntryDom = function(html) {
    var id = html.attr('id');
    var text = html.find('.button_label').text();

    if(id.search(/tag_entry_id_.*/) >= 0) {
        return { tid: id.replace(/^tag_entry_id_/, ''), name: text }
    } else {
        return { eid: id.replace(/^entry_id_/, ''), name: text }
    }
}

var fixDom = function(title, list, parentNode, htmlCreator, htmlReader, click) {
    function htmlMatches(html, item) {
        var data = htmlReader(html)
        var datas = JSON.stringify(data)
        var items = JSON.stringify(item)

        //log(datas, items)

        return datas == items
    }


    var children = parentNode.children();
    var n = 0;
    var kept = 0;
    var replaced = 0;
    var appended = 0;
    var deleted = 0;

    for(;n < list.length;++n) {
        var item = list[n];

        if(n >= children.length) {
            htmlCreator(item, click).appendTo(parentNode);
            appended++;
        } else {
            if(!htmlMatches($(children[n]), item)) {
                $(children[n]).replaceWith(htmlCreator(item, click));
                replaced++;
            } else {
                kept++;
            }
        }
    }
    for(;n < children.length; ++n) {
        $(children[n]).remove();
        deleted++;
    }
    log(title + "(replaced: " + replaced + ", deleted: " +
        deleted + ", appended: " + appended + ", kept: " + kept + ")");
}

module.exports = {
    fixEntriesDom: function(list, parentNode, click) {
        fixDom(
            "fixEntriesDom",
            list,
            parentNode,
            createEntryDom,
            readEntryDom,
            click
        );
    },
    fixTagsDom: function(list, parentNode, click) {
        fixDom(
            "fixTagsDom",
            list,
            parentNode,
            createTagDom,
            readTagDom,
            click
        );
    },
    readTagDom: readTagDom
}
