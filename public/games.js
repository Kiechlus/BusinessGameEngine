"use strict";
/* Put everything into an anonymous immediately called function 
in order not to pollute the global namespace
*/
(function() {

    // html-select with all available games
    var $games;
    // server sends available games
    var gameList;

    window.onload = function () {
        BGE.utils.setCSRFToken($('meta[name="_csrf"]').attr('content'));
        $games = document.getElementById("games");
        $games.value = 0;
        $.get(BGE.routes.gameList, gameListCallback);
        // TODO: gameList jede Sekunde abfragen, bei Veränderung clean() und fillSelect(). Auf dem Server als Array zwischenspeichern, damit nich jedes mal DB-Query.

        $("#create").click(clickCreate);
        $("#edit").click(clickEdit);
        $("#delete").click(clickDelete);
        $("#show").click(clickShow);
        $("#simulate").click(clickSimulate);
        $("#play").click(clickPlay);
        $("#analyse").click(clickAnalyse);
        $("#docu").click(clickDocu);
    };
    
    // flushes the back-forward chash in order to reload the game list (firefox only!)
    window.onunload = function() {};

    window.onpageshow = function() {
        //$("#select").load("/gameSelect", function(response, status, xhr) {console.log(response); console.log(status);});
        $games = document.getElementById("games");
        $.get(BGE.routes.gameList, gameListCallback); // on navigate: I get here, but $.get does not work and gameListCallback gets the old data
    };

    function gameListCallback(data) {
        gameList = data;
        fillSelect();
    }

    function clickCreate() {
        window.location.href = BGE.routes.create;
    }

    function clickEdit() {
        var hashBackup;
        if (checkSelect()) {
            var pw = prompt("Enter password");
            pwHandler(pw);
        } else {
            selectPrompt();
        }
        function pwHandler(password) {
            if (password) {
                var object = {};
                var hash = CryptoJS.SHA512(password);
                // The has object gets a string in a string context
                object.password = ""+hash;
                hashBackup = ""+hash;
                object.name = $games.value; 
                $.get(BGE.routes.pwCheck, object, pwMatchCallback);
            }
        }
        function pwMatchCallback(result) {
            if (result.pwMatch === true) {
                window.location.href = BGE.routes.edit + "?name=" + $games.value + "&pw=" + hashBackup;
            } else {
                alert("Passwords did not match.");
            }
        }   
    }

    function clickDelete() {
        if (checkSelect()) {
            var pw = prompt("Enter password");
            pwHandler(pw);
        } else {
            selectPrompt();
        }
        function pwHandler(password) {
            if (password) {
                var object = {};
                var hash = CryptoJS.SHA512(password);
                object.password = ""+hash;
                object.name = $games.value;      
                $.post(BGE.routes.delete, object, deleteCallback);
            }
        }
    }

    function clickShow() {
        if (checkSelect()) {
            window.location.href = BGE.routes.show + "?name=" + $games.value;
        } else {
            selectPrompt();
        }
    }

    function clickSimulate() {
        if (checkSelect()) {
            window.location.href = BGE.routes.simulate + "?name=" + $games.value;
        } else {
            selectPrompt();
        }
    }
    function clickPlay() {
        if (checkSelect()) {
            window.location.href = BGE.routes.play + "?name=" + $games.value;
        } else {
            selectPrompt();
        }
    }
    
    function clickAnalyse() {
        if (checkSelect()) {
            window.location.href = BGE.routes.analyse + "?name=" + $games.value;
        } else {
            selectPrompt();
        }
    }
    function clickDocu() {
        window.location.href = BGE.routes.docu;
    }

    function deleteCallback(result) {
        if (result.pwFail === true) {
            alert("Passwords did not match.");
            // cool, so lässt sich ein kleiner Bereich vom Server nachladen:
            //$("#select").load("/gameSelect", function(response, status, xhr) {console.log(response); console.log(status);});
        } else {
            $.get(BGE.routes.gameList, gameListCallback);
        }
    }

    function checkSelect() {
        var result = false;
        if ($games.value !== "") {
            result = true;
        }
        return result;
    }

    function fillSelect() {
        var gameNumber = gameList.length;
        var maxSelectSize = 20;
        $("#games")
            .find('option')
            .remove()
            .end()
        for(var i = 0; i < gameNumber; i++) {
            var opt = document.createElement('option');
            opt.innerHTML = gameList[i].name;
            opt.value = gameList[i].name;
            if (gameNumber <= 5) {
                $games.size = 5;
            }
            else if (gameNumber <= maxSelectSize) {
                $games.size = gameNumber;
            } else {
                $games.size = maxSelectSize;
            }
            $games.appendChild(opt);
        }
    }

    function selectPrompt() {
        alert("Please select a game.");
    }

})();
