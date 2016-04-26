var immigrationQuestionnaire = [
        {
            questionName: "firstName",
            questionText: "What is your first name?",
            answer: "string"
        },
        {
            questionName: "lastName",
            questionText: "What is your last name?",
            answer: "string"
        },
        {
            questionName: "age",
            questionText: "What is your age?",
            answer: "number"
        },
        {
            questionName: "nastyQuestion",
            questionText: "Have you ever been arrested or convicted for any offense or crime, even though subject of a pardon, amnesty or    other similar legal action? Have you ever unlawfully distributed or sold a controlled substance(drug), or been a prostitute or procurer for prostitutes?",
            answer: [
                "yes",
                "no",
                "maybe"
            ]
        },
        {
            questionName: "naziTest",
            questionText: "Do you seek to enter the United States to engage in export control violations, subversive or terrorist activities, or any other unlawful purpose? Are you a member or representative of a terrorist organization as currently designated by the U.S. Secretary of State? Have you ever participated in persecutions directed by the Nazi government of Germany; or have you ever participated in genocide? Have you ever participated in, ordered, or engaged in genocide, torture, or extrajudicial killings?",
            answer: [
                "yes",
                "no",
                "maybe",
                "I long for a righteous leader"
            ]
        }
    ];
/* 
 The first parameter is the name of the questionnaire.
 The last parameter defines the index of the round(s) before which the questionnaire will be 
 presented  to the players.
 0 means the questionnaire will be shown before the first round (round with index 0)
 It must be an array and can have one or several distinct numeric entries.
 A huge number will probably be after the last round.
 */
game.addQuestionnaire("immigration", immigrationQuestionnaire, [0]);