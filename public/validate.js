/* 
 * Business Game Engine (BGE): Create, play and analyze online multiplayer
 * business games used for education.
 * Copyright (C) 2015 Felix Kiechle <felix.kiechle@student.kit.edu>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

/*
Validation process for the create, edit, show and simulate page
- syntax check, duplicate name check (create, edit)
- restore formatting after database retrieval, where gameCode is saved in a single string (edit, show, simulate)
- check semantic whith the validate module (create, edit)
- transmit code to server (create, edit)
*/
(function() {
    var validateId;
    var $gameName;
    var $gameAuthor;
    var $gameDescription;
    var infoBox;
    var warnings = "";
    var validCode = false;
    var g_code;
    var g_codeAfterLoading;
    var edit;
    var show;
    var simulate;
    var create;

    window.onload = function () {
        BGE.utils.setCSRFToken($('meta[name="_csrf"]').attr('content'));
        var path = window.location.pathname;        
        edit = (path === BGE.routes.edit);
        show = (path === BGE.routes.show);
        simulate = (path === BGE.routes.simulate);
        create = (path === BGE.routes.create);
        var gameName = BGE.utils.getQueryVariable("name");
        $(window).resize(adjustEditor);
        adjustEditor();
        if (show || simulate) {
            $(".subheader").append(gameName);
            try {
                require(['custom/editor'], function (editor) {
                    window.editor = editor({ parent: 'editor', lang: 'js' });
                    $.get(BGE.routes.getCode, {name: gameName}, codeLoadedCallback);
                });
            } catch (e) {
            }
        }
        // create or edit
        else {
            try {
                require(['custom/editor'], function (editor) {
                    window.editor = editor({ parent: 'editor', lang: 'js' });
                    window.editor.getTextView().getModel().addEventListener("Changed", function () { validate(); });
                    // after the editor is loaded: check pw and load game code if passwords match
                    if (edit) {
                        var pw = BGE.utils.getQueryVariable("pw");
                        var object = {};
                        object.password = pw;
                        object.name = gameName; 
                        if (gameName && pw) {
                            $.get(BGE.routes.pwCheck, object, pwMatchCallback);
                        } else {
                            errorMessage("Permission denied.");
                        }
                    }
                    else if (create) {
                        var hash = CryptoJS.SHA512('template');
                        gameName = 'template';
                        // The has object gets a string in a string context
                        var object = {
                            password: ''+hash,
                            name: 'template'
                        }
                        $.get(BGE.routes.pwCheck, object, pwMatchCallback);
                    }
                });
                validate(55);
                
            } catch (e) {
            }
            $gameName = $('#gameName');
            $gameAuthor = $('#gameAuthor');
            $gameDescription = $('#gameDescription');
            infoBox = document.getElementById('info');
            $('#save').click(clickSave);
        }
        function pwMatchCallback(result) {
            if (result.pwMatch === true) {
                 $.get(BGE.routes.getCode, {name: gameName}, codeLoadedCallback);
            } else {
                errorMessage("Permission denied.");
            }
        } 
    };

    // Adjust the height of the editor
    function adjustEditor() {
        var showAdjust = show ? 50 : 0;
        var editorHeight = $(window).height() - 160 + showAdjust;
        $('#editor').attr('style', "height: "+ editorHeight +"px");
    }

    // Load code on edit or show page and reformat it
    function codeLoadedCallback(data) {
        var code = data.code;
        if (edit) {
            rewriteSourceCode(code);
            $gameName.val(data.name);
            $gameName.prop("disabled", true);
            $gameAuthor.val(data.author);
            $gameAuthor.prop("disabled", true);
            $gameDescription.val(data.description);
        }
        else if (create) {
            rewriteSourceCode(code);
        }
        else if (show) {
            rewriteSourceCode(code);
            window.editor.getTextView().setOptions({readonly: true});
            window.editor.removeAllErrorMarkers();
        }
        else if (simulate) {
            var rounds = BGE.simulate(code);
            // error during simulation
            if (rounds instanceof Error) {
                window.editor.setText(rounds.stack);
            } else {
                rewriteSourceCode(JSON.stringify(rounds));
            }
            window.editor.getTextView().setOptions({readonly: true});
            window.editor.removeAllErrorMarkers();
        }
    }

    // from the esprima and escodegen project
    function rewriteSourceCode(code) {
        var newCode;
        if (typeof window.editor !== 'undefined') {
            var option = {
                comment: true,
                format: {
                    indent: {
                        style: "    "
                    },
                    quotes: "double"
                }
            };
            try {
                var syntax;
                syntax = window.esprima.parse(code, { raw: true, tokens: true, range: true, comment: true });
                syntax = window.escodegen.attachComments(syntax, syntax.comments, syntax.tokens);
                newCode = window.escodegen.generate(syntax, option);
                g_codeAfterLoading = newCode;
                window.editor.setText(newCode);
            } catch (e) {
                errorMessage(e.stack);
            }
        }
    }

    // from the esprima project
    function validate(delay) {
        if (validateId) {
            window.clearTimeout(validateId);
        }
        validateId = window.setTimeout(function () {
            var syntax, errors, i;

            if (typeof window.editor === 'undefined') {
                g_code = document.getElementById('editor').value;
            } else {
                g_code = window.editor.getText();
                window.editor.removeAllErrorMarkers();
            }
            try {
                syntax = esprima.parse(g_code, { tolerant: true, loc: true });
                errors = syntax.errors;
                if (errors.length > 0) {
                    for (i = 0; i < errors.length; i += 1) {
                        window.editor.addErrorMarker(errors[i].index, errors[i].description);
                    }
                    errorMessage('Invalid code. Total issues: ' + errors.length);
                    validCode = false;
                } else {
                    validMessage('Code is syntactically valid.');
                    if (syntax.body.length === 0) {
                        infoBox.innerHTML = 'Empty code. Nothing to validate.';
                    }
                    validCode = true;
                }
            } catch (e) {
                window.editor.addErrorMarker(e.index, e.description);
                errorMessage(e.toString());
                validCode = false;
            }

            validateId = undefined;
        }, delay || 811);
    }

    // post the code to the server if everything is valid
    function clickSave() {
        if (readyToSave()) {
            var object = {};
            object.code = g_code;
            object.name = $gameName.val().trim();
            object.description = $gameDescription.val().trim();
            object.author = $gameAuthor.val().trim();
            if (edit) {
                object.edit = true;
                $.post(BGE.routes.code, object, serverValidation);
            }
            // ask for a password when a new game is created
            else if (create) {
                var pw = prompt("Enter password. Needed to edit or delete the game.");
                pwHandler(pw);
                // Allow saving twice when coming from game creation
                edit = true;
            }
        }
        function pwHandler(password, pwRepeat) {
            var hash = CryptoJS.SHA512(password);
            // The has object gets a string in a string context
            object.password = ""+hash;
            $.post(BGE.routes.code, object, serverValidation);
        }
    }

    function serverValidation(data) {
        if (!data.errors) {
            if (warnings === "") {
                validMessage("Game saved successfully.");
            } else {
                alertMessage("Game saved with warnings: " + warnings);
                warnings = "";
            }
            g_codeAfterLoading = g_code;
        } else {
            errorMessage(data.errors);
        }
    }

    function readyToSave() {
        var result = true;
        try {
            var semanticCheck = BGE.validate.gameSemantics(g_code);
        } catch (e) {
            errorMessage(e.stack);
            result = false;
        }
        if ($gameName.val().trim() === "") {
            errorMessage('Please enter a game name.');
            result = false;
        }
        else if (validCode === false) {
            errorMessage('Code is syntactically invalid! Please correct before saving.');
            result = false;
        }
        else if (g_code === undefined || g_code.trim() === "") {
            errorMessage("Empty code.");
            result = false;
        }
        else if (g_code === g_codeAfterLoading) {
            errorMessage("No changes detected.");
            result = false;
        }
        else if (semanticCheck && semanticCheck.errors !== "") {
            errorMessage(semanticCheck.errors);
            result = false;
        }
        else if (semanticCheck && semanticCheck.warnings !== "") {
            warnings = semanticCheck.warnings;
            result = true;
        }
        return result;
    }


    function errorMessage(message) {
        infoBox.innerHTML = message;
        infoBox.setAttribute('class', 'alert-box alert');
    }

    function validMessage(message) {
        infoBox.innerHTML = message;
        infoBox.setAttribute('class', 'alert-box success');
    }
    
    function alertMessage(message) {
        infoBox.innerHTML = message;
        infoBox.setAttribute('class', 'alert-box secondary');
    }
})();







