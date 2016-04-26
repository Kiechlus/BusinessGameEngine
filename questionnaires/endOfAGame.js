var endOfGameQuestionnaire = [
        {
            questionName: "q1",
            questionText: "Did you like the game?",
            answer: [
                "yes",
                "no"
            ]
        },
        {
            questionName: "q2",
            questionText: "Would you play it again?",
            answer: [
                "yes",
                "no",
                "maybe"
            ]
        },
        {
            questionName: "strategy",
            questionText: "What strategy do you think is most useful to win?",
            answer: "string"
        },
        {
            questionName: "strategyChange",
            questionText: "Did you change your strategy during the game?",
            answer: "string"
        },
        {
            questionName: "strategy3",
            questionText: "If yes, why was this necessary?",
            answer: "string"
        }
    ];
game.addQuestionnaire("endOfGame", endOfGameQuestionnaire, [999]);