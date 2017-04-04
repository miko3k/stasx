"use strict";

var $ = require('jquery')
var browser_util = require('./browser-util')
var log = require('./log')
var Icn = require('./icons')
var Str = require('./strings')

var CANCEL_EVENT = "cancel";

var Enabled = {
    LOADING: 2,
    ENABLED: 1,
    DISABLED: 0
}

function Popup(title, icon) {
    this._icon = icon
    this._title = title;
    this._submit_action = null
    this._cancel_action = null
    this._submit_button = null
    this._enabled = Enabled.ENABLED
    this._onshow = null
    this._onhide = null
    this._focus_on_show = null
    this._buttons = [];
    this._elements = []
    this._tabs = []
    this._parent_form = null // must be set when showing!
    this._hide_callback = null // must be set when showing!
    this._password_input = false
    this._action_callback = null

    Object.seal(this)
}

Popup.prototype.isShown = function() {
    return this._parent_form != null;
}

function rebindSubmit(popup) {
    // we remove handler for safety when disabling the button, we have to re-add it
    var btn = popup._submit_button
    if(btn) {
        btn.off('click').click(function() {
            log("submit by button");
            submitClicked(popup)
            return false;
        });
    }
}

function doAction(popup, callback, data) {
    if(typeof callback === "string") {
        if(popup._action_callback) {
            popup._action_callback(callback, data)
        }
        return true
    } else {
        callback()
        return false
    }
}

function getContentDiv(form)
{
    return form.children(".window_content")
}

function addLoadingDiv(content_div)
{
    var div = $("<div/>").addClass("window_loading")
    var icon = browser_util.faIcon("fa-circle-o-notch").addClass("fa-spin")

    div.append(icon).appendTo(content_div)
}

function removeLoadingDiv(content_div)
{
    content_div.children(".window_loading").remove()
}

function addButton(popup, text, icon, callback) {
    var btn = browser_util.button(text, icon)
    if(callback) {
        btn.click(function() {
            doAction(this, callback)
            return false;
        });
    }
    popup._buttons.push(btn);
    return btn;
}

Popup.prototype.addTab = function(text, icon, id) {
    this._tabs.push({
        'text': text,
        'icon': icon,
        'id': id
    })
}

Popup.prototype.addButton = function(text, icon, callback) {
    return addButton(this, text, icon, callback)
}

Popup.prototype.addSubmit = function(text, icon, callback) {
    this._submit_action = callback
    this._submit_button = addButton(this, text, icon);
    return this._submit_button
}

Popup.prototype.addCancel = function(text, icon, id) {
    var popup = this
    if(id) {
        this._cancel_action = id
    }

    return addButton(this, text, icon, function() {
        cancelClicked(popup);
    })
}

Popup.prototype.addBody = function(el) {
    if(el instanceof PasswordInput) {
        this._elements.push(el._body)
        this._password_input = true
    } else if(el instanceof Element) {
        this._elements.push($(el))
    } else {
        this._elements.push(el);
    }
    return el
}

Popup.prototype.addLink = function(str, icon, id) {
    var btn = browser_util.button(str, icon)
    var popup = this
    if(id) {
        btn.click(function() {
            if(btn.is('[href]')) {
                doAction(popup, id)
            }
            return false
        })
    } else {
        browser_util.disableButton(btn);
    }
    return this.addBody(btn)
}

Popup.prototype.addText = function(text) {
    var e = this.addBody($("<p/>").text(text))
    return e
}

Popup.prototype.addFocusedBody = function(el) {
    var e = this.addBody(el)
    this._focus_on_show = e
    return e
}

Popup.prototype.addTextInput = function(text) {
    var input = $("<input/>").attr("type", "text")
    if(text) input.val(text)
    return this.addBody(input)
}

Popup.prototype.addFocusedTextInput = function(text) {
    var input = this.addTextInput(text);
    this._focus_on_show = input
    return input
}

Popup.prototype.addPasswordInput = function(text) {
    return this.addBody(Popup.createPasswordInput(text))
}

Popup.prototype.addFocusedPasswordInput = function(text) {
    return this.addFocusedBody(Popup.createPasswordInput(text))
}

function PasswordInput(text) {
    var wrapper = $("<div/>").addClass('password_field')
    var input = $("<input/>").attr("type", "password")
    var icon = $("<a/>").addClass('password_icon').attr('href', '')

    input.val(text || '')

    var is_password = function() { return input.attr('type') == 'password' }
    var set_icon = function() { browser_util.faIcon(is_password() ? Icn.EYE : Icn.ELLIPSIS).appendTo(icon.empty()) }

    set_icon()
    icon.click(function() {
        // keeping focused state is hard, because clicking icon removes focus from input, so we will simply
        // focus input, ignoring previous state

        var selectionStart = input[0].selectionStart
        var selectionEnd = input[0].selectionEnd

        log("toggle password field", selectionStart, selectionEnd)

        input.attr('type', is_password() ? 'text' : 'password');

        set_icon();

        input[0].selectionStart = selectionStart
        input[0].selectionEnd = selectionEnd
        input.focus()
        return false;
    });

    wrapper.append(input)
    wrapper.append(icon)

    this._input = input
    this._body = wrapper
}

PasswordInput.prototype.addStrengthMeter = function() {
    // in theory, zxcvbn may not be loaded, in that case just don't display strength meter
    if(typeof zxcvbn !== 'function')
        return;

    var input = this._input
    var wrapper = this._body

    var gauge = $("<div/>").addClass('strength_meter').
        text('Weak')
    wrapper.append(gauge)

    var sharp_gradient = function(amount, color1, color2) {
        if(amount < 0) amount = 0;
        if(amount > 100) amount = 100;
        amount = amount.toString()

        //'linear-gradient(90deg, pink 50%, cyan 50%)')
        var css = 'linear-gradient(90deg, ' +
                color1 + ' ' + amount + '%, ' +
                color2 + ' ' + amount + '%)'

//        log('gradient:', css)

        return css
    }

    var fixbackground = function() {
        var pwd = input.val();
        var strength = pwd.length * 10
        var hint

        if(pwd.length == 0) {
            strength = 0
            hint = Str.NO_PASSWORD
        } else {
            var res = zxcvbn(pwd)
            strength = res.guesses_log10 * 6
            if(res.feedback.warning) {
                hint = res.feedback.warning;
            } else {
                hint = Str.CRACK_TIME.replace('%', res.crack_times_display.offline_slow_hashing_1e4_per_second)
            }
        }
        gauge.text(hint)

        log(zxcvbn(pwd))

        gauge.css('background', sharp_gradient(strength, '#3f6679', 'rgba(0,0,0,0)'))
    }

    input.on('input', fixbackground)
    fixbackground()
}

PasswordInput.prototype.setPlaceholder = function(text) {
    this._input.attr('placeholder', text)
}

PasswordInput.prototype.showAsCorrect = function() {
    this._input.removeClass("bad_password");
    this._input.addClass("correct_password");
}

PasswordInput.prototype.showAsBad = function() {
    this._input.addClass("bad_password");
    this._input.removeClass("correct_password");
}

PasswordInput.prototype.showAsNeutral = function() {
    this._input.removeClass("bad_password");
    this._input.removeClass("correct_password");
}

PasswordInput.prototype.show = function() { return this._body.show() }
PasswordInput.prototype.hide = function() { return this._body.hide() }
PasswordInput.prototype.focus = function() { return this._input.focus() }
PasswordInput.prototype.select = function() { return this._input.select() }
PasswordInput.prototype.onInput = function(x) { return this._input.on('input', x) }
PasswordInput.prototype.val = function(x) {
    if(x === undefined) {
        return this._input.val()
    } else {
        var res = this._input.val(x)
        this._input.trigger('input')
        return res
    }
}

Popup.createPasswordInput = function(text) {
    return new PasswordInput(text)
}

Popup.prototype.onShow = function(fn) {
    this._onshow = fn
}

Popup.prototype.onHide = function(fn) {
    this._onhide = fn
}

Popup.prototype.onAction = function(fn) {
    this._action_callback = fn
}

function doDisable(popup, st) {
    popup._enabled = st;
    if(popup._parent_form) {
        removeLoadingDiv(getContentDiv(popup._parent_form))

        if(st == Enabled.LOADING) {
            addLoadingDiv(getContentDiv(popup._parent_form))
        }
    }
    if(popup._submit_button) {
        browser_util.disableButton(popup._submit_button);
    }
}

Popup.prototype.disable = function() {
    doDisable(this, Enabled.DISABLED)
}

Popup.prototype.loading = function() {
    doDisable(this, Enabled.LOADING)
}

Popup.prototype.enable = function() {
    this._enabled = Enabled.ENABLED;
    if(this.isShown()) {
        if(this._submit_button) {
            browser_util.enableButton(this._submit_button);
            rebindSubmit(this)
        }
        removeLoadingDiv(getContentDiv(this._parent_form))
    }
}


function submitClicked(popup) {
    if(popup._enabled == Enabled.ENABLED && popup._submit_action) {
        doAction(popup, popup._submit_action)
    }
}

function cancelClicked(popup) {
    if(popup._cancel_action) {
        doAction(popup, popup._cancel_action)
    } else {
        popup.hide()
    }
}

Popup.prototype.action = function(string, value) {
    this._action_callback(string, value)
}

Popup.prototype.hide = function() {
    this._hide_callback();
    if(this._onhide)
        this._onhide();

}


function prepareShow(popup, form, how_to_show, hide_callback, transform) {
    var head = $(browser_util.headingDom("h1", popup._title, popup._icon))

    var content = $('<div/>').addClass('window_content')
    content.append(popup._elements);

    if(popup._enabled == Enabled.LOADING) {
        addLoadingDiv(content)
    }

    // without submit button submitting by ENTER key behaves quite randomly
    var submit = $("<input/>");
    submit.attr("type", "submit")
    submit.hide();
    content.append(submit);

    var buttons = $("<div/>").addClass("buttons")
    buttons.append(popup._buttons);

    var tabs = null;
    popup._tabs.forEach(function(el) {
        if(!tabs)
            tabs = $("<div/>").addClass("window_tabs");

        var b = browser_util.button(el.text, el.icon)
        if(!el.id) {
            browser_util.disableButton(b);
        } else {
            b.click(function() {
                doAction(popup, el.id)
                return false
            });
        }

        tabs.append(b)
    })

    var tmpform = $("<div/>")
    tmpform.append(head)
    if(tabs) tmpform.append(tabs)
    tmpform.append(content)
    tmpform.append(buttons)

    if(transform) {
        transform(tmpform)
    }

    form.empty().append(tmpform.children())

    popup._parent_form = form
    popup._hide_callback = hide_callback
    how_to_show()

    if(popup._submit_button) {
        if(popup._enabled != Enabled.ENABLED) {
            browser_util.disableButton(popup._submit_button);
        } else {
            rebindSubmit(popup)
        }
    }

    form.off('submit').on('submit', function() {
        log("submit by enter");
        submitClicked(popup);
        return false;
    });

    // if we have password field displayed, we will not rely on default submit, because it displays
    // password manager and we don't want that
    form.off('keypress')
    if(popup._password_input) {
        form.on('keypress', function(ev) {
            // if this was DOM event, we should use KeyboardEvent.code (and KeyboardEvent.which is deprecated)
            // however, this is jquery event, and which is normalized by jquery <https://api.jquery.com/event.which>
            if(ev.which == 13) {
                log("submit by keycode")
                submitClicked(popup);
                return false
            }
        });
    }
    form.off(CANCEL_EVENT).on(CANCEL_EVENT, function() {
        cancelClicked(popup)
    });

    if(popup._onshow) {
        popup._onshow();
    }
    if(popup._focus_on_show) {
        popup._focus_on_show.focus();
    }
}


Popup.prototype.showInDetail = function() {
    var form = $('#detail_form')
    var hide = form.hide.bind(form, 200)

    prepareShow(this, form, function() {
        form.show(200);
    }, hide);
}

Popup.cancelInDetail = function() {
    $("#detail_form").trigger(CANCEL_EVENT)
}

Popup.ensureHiddenInDetail = function() {
    $('#detail_form').hide();
}

Popup.isVisibleInDetail = function() {
    return $("#detail_form").is(":visible")
}

Popup.prototype.showModal = function(x, y) {

    var form = $('#popup_form')
    form.css('left', x);
    form.css('top', y);

    prepareShow(this, form, function() {
        if(browser_util.isMobile()) {
            $('#popup_container').show(200);
        } else {
            $('#popup_container').fadeIn(200);
        }
    }, Popup.hideModal)
}

function selectAnimated(parent_form, params) {
    var include_tabs = params.tabs
    var title = params.title
    var buttons = params.buttons

    var result = parent_form.find(".window_content")

    if(buttons) {
        result = result.add(parent_form.find(".buttons").children())
    }

    if(title) {
        result = result.add(parent_form.find("h1").children())
    }

    if(include_tabs) {
        result = result.add(parent_form.find(".window_tabs"))
    }

    return result
}

Popup.prototype.showInstead = function(prev) {
    var form = prev._parent_form
    var next = this

    var params = {
        tabs: this._tabs.length == 0 || prev._tabs.length == 0,
        title: this._title != prev._title,
        buttons: this._buttons.length != prev._buttons.length
    }

    var transform = function(form) {
        selectAnimated(form, params).css({ "opacity": 0 })
    }

    var animated = selectAnimated(form, params)

    $.when(animated.fadeTo(150, 0)).then(function() {
        prepareShow(next, form, function() {
            selectAnimated(form, params).fadeTo(350, 1)
        }, prev._hide_callback, transform)
    })
    return this
}

Popup.hideModal = function() {
    if(browser_util.isMobile()) {
        $('#popup_container').hide(200);
    } else {
        $('#popup_container').fadeOut(200);
    }
    return false;
}

Popup.isVisibleModal = function() {
    return $("#popup_container").is(":visible")
}

Popup.cancelModal = function() {
    $("#popup_form").trigger(CANCEL_EVENT)
}


module.exports = Popup
