//AMD insanity
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else {
        // Browser globals
        root.hypescript = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    return (function () {
            'use strict';

            //-----------------------------------------------
            // Utilities
            //-----------------------------------------------
            function matchesSelector(elt, selector) {
                // noinspection JSUnresolvedVariable
                var matchesFunction = elt.matches ||
                    elt.matchesSelector || elt.msMatchesSelector || elt.mozMatchesSelector
                    || elt.webkitMatchesSelector || elt.oMatchesSelector;
                return matchesFunction && matchesFunction.call(elt, selector);
            }

            function defaultEvent(elt) {
                if (matchesSelector(elt, 'form'))
                    return 'submit';
                if (matchesSelector(elt, 'input, textarea, select'))
                    return 'change';
                return 'click';
            }

            function makeEventListener(actionList, elt) {
                return function (event) {
                    var ctx = {
                        me: elt,
                        detail: event.detail,
                        event: event
                    }
                    actionList.start.exec(actionList.start, elt, ctx);
                };
            }

            //-----------------------------------------------
            // Lexer
            //-----------------------------------------------
            var _lexer = function() {
                var optable = {
                    '+': 'PLUS',
                    '-': 'MINUS',
                    '*': 'MULTIPLY',
                    '.': 'PERIOD',
                    '\\': 'BACKSLASH',
                    ':': 'COLON',
                    '%': 'PERCENT',
                    '|': 'PIPE',
                    '!': 'EXCLAMATION',
                    '?': 'QUESTION',
                    '#': 'POUND',
                    '&': 'AMPERSAND',
                    ';': 'SEMI',
                    ',': 'COMMA',
                    '(': 'L_PAREN',
                    ')': 'R_PAREN',
                    '<': 'L_ANG',
                    '>': 'R_ANG',
                    '{': 'L_BRACE',
                    '}': 'R_BRACE',
                    '[': 'L_BRACKET',
                    ']': 'R_BRACKET',
                    '=': 'EQUALS'
                };

                function isValidCSSClassChar(c) {
                    return isAlpha(c) || isNumeric(c) || c === "-" || c === "_";
                }

                function isValidCSSIDChar(c) {
                    return isAlpha(c) || isNumeric(c) || c === "-" || c === "_" || c === ":" || c === ".";
                }

                function isWhitespace(c) {
                    return c === " " || c === "\t" || isNewline(c);
                }

                function positionString(token) {
                    return "[Line: " + token.line + ", Column: " + token.col + "]"
                }


                function isNewline(c) {
                    return c === '\r' || c === '\n';
                }

                function isNumeric(c) {
                    return c >= '0' && c <= '9';
                }

                function isAlpha(c) {
                    return (c >= 'a' && c <= 'z') ||
                        (c >= 'A' && c <= 'Z');
                }

                function makeTokensObject(tokens, consumed, source) {
                    function matchOpToken(value) {
                        if (currentToken() && currentToken().value === value && currentToken().type !== "STRING") {
                            return consumeToken();
                        }
                    }

                    function requireTokenType(type1, type2, type3) {
                        var token = matchTokenType(type1, type2, type3);
                        if (token) {
                            return token;
                        } else {
                            raiseError(tokens, "Expected one of " + JSON.stringify([type1, type2, type3]));
                        }
                    }

                    function matchTokenType(type1, type2, type3) {
                        if (currentToken() && currentToken().type && [type1, type2, type3].indexOf(currentToken().type) >= 0) {
                            return consumeToken();
                        }
                    }

                    function consumeToken() {
                        var match = tokens.shift();
                        consumed.push(match);
                        return match;
                    }

                    function matchToken(value, type) {
                        var type = type || "IDENTIFIER";
                        if (currentToken() && currentToken().value === value && currentToken().type === type) {
                            return consumeToken();
                        }
                    }

                    function hasMore() {
                        return tokens.length > 0;
                    }

                    function currentToken() {
                        return tokens[0];
                    }

                    return {
                        matchOpToken: matchOpToken,
                        requireTokenType: requireTokenType,
                        matchTokenType: matchTokenType,
                        consumeToken: consumeToken,
                        matchToken: matchToken,
                        list: tokens,
                        source: source,
                        hasMore:hasMore,
                        currentToken:currentToken
                    }
                }

                function tokenize(string) {
                    var source = string;
                    var tokens = [];
                    var position = 0;
                    var column = 0;
                    var line = 1;
                    var lastToken = "START";

                    while (position < source.length) {
                        consumeWhitespace();
                        if (currentChar() === "-" && nextChar() === "-") {
                            consumeComment();
                        } else {
                            if (isPrecendingWhitespace() && currentChar() === "." && isAlpha(nextChar())) {
                                tokens.push(consumeClassReference());
                            } else if (isPrecendingWhitespace() && currentChar() === "#" && isAlpha(nextChar())) {
                                tokens.push(consumeIdReference());
                            } else if (isAlpha(currentChar())) {
                                tokens.push(consumeIdentifier());
                            } else if (isNumeric(currentChar())) {
                                tokens.push(consumeNumber());
                            } else if (currentChar() === '"') {
                                tokens.push(consumeString());
                            } else if (optable[currentChar()]) {
                                tokens.push(makeToken(optable[currentChar()], consumeChar()));
                            }
                        }
                    }

                    return makeTokensObject(tokens, [], source);

                    function makeToken(type, value) {
                        return {
                            type: type,
                            value: value,
                            start: position,
                            end: position + 1,
                            column: column,
                            line: line
                        };
                    }

                    function consumeComment() {
                        while (!isNewline(currentChar())) {
                            consumeChar();
                        }
                        consumeChar();
                    }

                    function consumeClassReference() {
                        var classRef = makeToken("CLASS_REF");
                        var value = consumeChar();
                        while (isValidCSSClassChar(currentChar())) {
                            value += consumeChar();
                        }
                        classRef.value = value;
                        classRef.end = position;
                        return classRef;
                    }


                    function consumeIdReference() {
                        var idRef = makeToken("ID_REF");
                        var value = consumeChar();
                        while (isValidCSSIDChar(currentChar())) {
                            value += consumeChar();
                        }
                        idRef.value = value;
                        idRef.end = position;
                        return idRef;
                    }

                    function consumeIdentifier() {
                        var identifier = makeToken("IDENTIFIER");
                        var value = consumeChar();
                        while (isAlpha(currentChar())) {
                            value += consumeChar();
                        }
                        identifier.value = value;
                        identifier.end = position;
                        return identifier;
                    }

                    function consumeNumber() {
                        var number = makeToken("NUMBER");
                        var value = consumeChar();
                        while (isNumeric(currentChar())) {
                            value += consumeChar();
                        }
                        if (currentChar() === ".") {
                            value += consumeChar();
                        }
                        while (isNumeric(currentChar())) {
                            value += consumeChar();
                        }
                        number.value = value;
                        number.end = position;
                        return number;
                    }

                    function consumeString() {
                        var string = makeToken("STRING");
                        var value = consumeChar();
                        while (currentChar() && currentChar() !== '"') {
                            if (currentChar() === "\")") {
                                consumeChar();
                            }
                            value += consumeChar();
                        }
                        if (currentChar() !== '"') {
                            throw Error("Unterminated string at " + positionString(string));
                        } else {
                            consumeChar(); // consume final quote
                        }
                        string.end = position;
                        return string;
                    }

                    function currentChar() {
                        return source.charAt(position);
                    }

                    function nextChar() {
                        return source.charAt(position + 1);
                    }

                    function consumeChar() {
                        lastToken = currentChar();
                        position++;
                        column++;
                        return lastToken;
                    }

                    function isPrecendingWhitespace() {
                        return lastToken === "START" || isWhitespace(lastToken);
                    }

                    function consumeWhitespace() {
                        while (currentChar() && isWhitespace(currentChar())) {
                            if (isNewline(currentChar())) {
                                column = 0;
                                line++;
                            }
                            consumeChar();
                        }
                    }
                }
                return {
                    tokenize:tokenize
                }
            }();

            //-----------------------------------------------
            // Parser
            //-----------------------------------------------
            var _parser = function () {

                function parseInterval(tokens) {
                    var number = tokens.requireTokenType(tokens, "NUMBER");
                    var factor = 1;
                    if (tokens.matchToken( "s")) {
                        factor = 1000;
                    } else if (tokens.matchToken( "ms")) {
                        // do nothing
                    }
                    return parseFloat(number.value) * factor;
                }

                function parseTargetExpression(tokens, identifier) {
                    if (tokens.matchToken(identifier)) {
                        return {
                            type: "target",
                            value: tokens.requireTokenType("IDENTIFIER", "CLASS_REF", "ID_REF").value
                        }
                    }
                }

                function parseAttributeExpression(tokens) {
                    var classRef = tokens.matchTokenType("CLASS_REF");
                    if (classRef) {
                        return {
                            name: "class",
                            value: classRef.value.substr(1)
                        }
                    } else {
                        var name = tokens.matchTokenType( "IDENTIFIER");
                        tokens.matchOpToken("=");
                        var value = tokens.matchTokenType( "IDENTIFIER", "STRING");
                        return {
                            name: name.value,
                            value: value.value
                        }
                    }
                }

                function consumeRestOfCommand(tokens) {
                    var firstToken = null;
                    var lastToken = null;
                    while (tokens.hasMore()) {
                        if (tokens.currentToken() !== 'then') {
                            lastToken = tokens.consumeToken();
                        }
                        if (firstToken == null) {
                            firstToken = lastToken;
                        }
                    }
                    return tokens.source.substr(firstToken.start, lastToken.end);
                }

                function raiseError(tokens, message) {
                    message = message || "Unexpected Token : " + tokens.currentToken().value;
                    var error = new Error(message);
                    error.tokens = tokens;
                    throw error
                }

                function parseCommand(tokens) {
                    var commandName = tokens.matchTokenType("IDENTIFIER");
                    var commandDef = COMMANDS[commandName.value];
                    if (commandDef) return commandDef(_parser, _runtime, tokens);
                    raiseError(tokens);
                }

                function parseCommandList(tokens) {
                    var commandList = {
                        type: "command_list",
                        on: parseTargetExpression(tokens, "on"),
                        start: parseCommand(tokens)
                    }
                    var last = commandList.start;
                    while (tokens.matchToken( "then")) {
                        last.next = parseCommand(tokens);
                        last = last.next;
                    }
                    return commandList;
                }

                function parseHypeScript(tokens) {
                    var hypeScript = {
                        type: "hype_script",
                        commandLists: []
                    }
                    do {
                        hypeScript.commandLists.push(parseCommandList(tokens));
                    } while (tokens.matchToken( "end"))
                    return hypeScript;
                }

                return {
                    // parser API
                    parseAttributeExpression: parseAttributeExpression,
                    parseTargetExpression: parseTargetExpression,
                    consumeRestOfCommand: consumeRestOfCommand,
                    parseInterval: parseInterval,
                    parseCommandList: parseCommandList,
                    parseHypeScript: parseHypeScript,
                }
            }();

            //-----------------------------------------------
            // Runtime
            //-----------------------------------------------
            var _runtime = function () {
                function forTargets(targetExpr, elt, callback) {
                    forEach(evalTargetExpr(targetExpr, elt), function (target) {
                        callback(target);
                    });
                }

                function triggerEvent(elt, eventName) {
                    var detail = {sent_by: elt};
                    var event = makeEvent(eventName, detail);
                    var eventResult = elt.dispatchEvent(event);
                    return eventResult;
                }

                function evalTargetExpr(expr, elt) {
                    if (expr) {
                        return document.querySelectorAll(expr.value);
                    } else {
                        return [elt];
                    }
                }

                function forEach(arr, func) {
                    for (var i = 0; i < arr.length; i++) {
                        func(arr[i]);
                    }
                }

                function execNext(that, elt, context) {
                    if (that.next) {
                        that.next.exec(that.next, elt, context);
                    }
                }

                function makeEvent(eventName, detail) {
                    var evt;
                    if (window.CustomEvent && typeof window.CustomEvent === 'function') {
                        evt = new CustomEvent(eventName, {bubbles: true, cancelable: true, detail: detail});
                    } else {
                        evt = document.createEvent('CustomEvent');
                        evt.initCustomEvent(eventName, true, true, detail);
                    }
                    return evt;
                }


                return {
                    forEach: forEach,
                    triggerEvent: triggerEvent,
                    evalTargetExpr: evalTargetExpr,
                    forTargets: forTargets,
                    execNext: execNext,
                    matchesSelector: matchesSelector,
                    makeEvent: makeEvent
                }
            }();

            //-----------------------------------------------
            // Commands
            //-----------------------------------------------
            var COMMANDS = {}
            function addCommand(name, definition) {
                COMMANDS[name] = definition;
            }

            addCommand("add", function (parser, runtime, tokens) {
                return {
                    type: "add",
                    attribute: parser.parseAttributeExpression(tokens),
                    to: parser.parseTargetExpression(tokens, "to"),
                    exec: function (self, elt, context) {
                        runtime.forTargets(self.to, elt, function (target) {
                            if (self.attribute.name === "class") {
                                target.classList.add(self.attribute.value);
                            } else {
                                target.setAttribute(self.attribute.name, self.attribute.value)
                            }
                        });
                        runtime.execNext(self, elt, context);
                    }
                };
            });

            addCommand("remove", function (parser, runtime,tokens) {
                return {
                    type: "remove",
                    attribute: parser.parseAttributeExpression(tokens),
                    from: parser.parseTargetExpression(tokens, "from"),
                    exec: function (self, elt, context) {
                        runtime.forTargets(self.from, elt, function (target) {
                            if (self.attribute.name === "class") {
                                target.classList.remove(self.attribute.value);
                            } else {
                                target.removeAttribute(self.attribute.name)
                            }
                        });
                        runtime.execNext(self, elt, context);
                    }
                }
            });

            addCommand("toggle", function (parser, runtime, tokens) {
                return {
                    type: "toggle",
                    attribute: parser.parseAttributeExpression(tokens),
                    on: parser.parseTargetExpression(tokens, "on"),
                    exec: function (self, elt, context) {
                        runtime.forTargets(self.on, elt, function (target) {
                            if (self.attribute.name === "class") {
                                target.classList.toggle(self.attribute.value);
                            } else {
                                if (target.getAttribute(self.attribute.name)) {
                                    target.removeAttribute(self.attribute.name);
                                } else {
                                    target.setAttribute(self.attribute.name, self.attribute.value);
                                }
                            }
                        });
                        runtime.execNext(self, elt, context);
                    }
                }
            })

            addCommand("eval", function (parser, runtime, tokens) {
                var evalExpr = {
                    type: "eval",
                    eval: parser.consumeRestOfCommand(tokens),
                    exec: function (self, elt, context) {
                        eval(self.eval);
                        runtime.execNext(self, elt, context);
                    }
                }
                return evalExpr;
            })

            addCommand("wait", function (parser, runtime, tokens) {
                return {
                    type: "wait",
                    time: parser.parseInterval(tokens),
                    exec: function (self, elt, context) {
                        setTimeout(function () {
                            runtime.execNext(self, elt, context);
                        }, self.time);
                    }
                }
            })

            addCommand("send", function (parser, runtime, tokens) {
                return {
                    type: "send",
                    eventName: tokens.matchTokenType(tokens, "IDENTIFIER"),
                    to: parser.parseTargetExpression(tokens, "to"),
                    exec: function (self, elt, context) {
                        runtime.forTargets(self.to, elt, function (target) {
                            runtime.triggerEvent(target, self.eventName.value);
                        })
                        runtime.execNext(self, elt, context);
                    }
                }
            })

            //-----------------------------------------------
            // API
            //-----------------------------------------------
            function parse(string) {
                var tokens = _lexer.tokenize(string);
                return _parser.parseHypeScript(tokens);
            }

            function applyHypeScript(hypeScript, elt) {
                for (var i = 0; i < hypeScript.commandLists.length; i++) {
                    var actionList = hypeScript.commandLists[i];
                    if (actionList.on) {
                        var event = actionList.on.value;
                    } else {
                        var event = defaultEvent(elt);
                    }
                    elt.addEventListener(event, makeEventListener(actionList, elt));
                }
            }

            function getHyped(elt) {
                if (elt) {
                    var hypeScript = elt.getAttribute("_")
                        || elt.getAttribute("hs")
                        || elt.getAttribute("data-hs");
                    if (hypeScript) {
                        var parseTree = parse(hypeScript);
                        applyHypeScript(parseTree, elt);
                    }
                } else {
                    var fn = function () {
                        var all = document.querySelectorAll("[_], [hs], [data-hs]");
                        for (var i = 0; i < all.length; i++) {
                            var elt = all[i];
                            getHyped(elt);
                        }
                    }
                    if (document.readyState !== 'loading') {
                        fn();
                    } else {
                        document.addEventListener('DOMContentLoaded', fn);
                    }
                }
            }

            return {
                lexer: _lexer,
                parser: _parser,
                runtime: _runtime,
                addCommand: addCommand,
                getHyped: getHyped
            }
        }
    )()
}));