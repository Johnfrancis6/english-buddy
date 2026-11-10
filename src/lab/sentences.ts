/**
 * Sentences with deliberate mistakes typical of French speakers. The learner
 * reads each one exactly as written; a transcript "keeps" a mistake when the
 * wrong form is still there, and "fixes" it when the correct form appears.
 * Each `wrong` phrase is unique in its sentence and contains no number.
 */
export interface PlantedMistake {
  /** Accepted spellings of the mistake, normalised (see normalise()). */
  wrong: string[];
  /** Spellings that show the recogniser silently corrected it. */
  right: string[];
  /** Short French label shown in the lab. */
  label: string;
}

export interface LabSentence {
  say: string;
  mistakes: PlantedMistake[];
}

export const LAB_SENTENCES: LabSentence[] = [
  {
    say: 'Yesterday I go to the cinema with my friends.',
    mistakes: [{ wrong: ['i go to'], right: ['i went to'], label: 'go → went (passé)' }],
  },
  {
    say: 'She don’t like coffee in the morning.',
    mistakes: [
      {
        wrong: ["she don't", 'she do not'],
        right: ["she doesn't", 'she does not'],
        label: 'don’t → doesn’t (accord)',
      },
    ],
  },
  {
    say: 'I am agree with you about this project.',
    mistakes: [
      { wrong: ['i am agree', "i'm agree"], right: ['i agree'], label: 'I am agree → I agree' },
    ],
  },
  {
    say: 'He is working here since three years.',
    mistakes: [
      {
        wrong: ['he is working', "he's working"],
        right: ['has been working', "he's been working"],
        label: 'is working → has been working',
      },
      { wrong: ['since three years'], right: ['for three years'], label: 'since → for' },
    ],
  },
  {
    say: 'The people is very friendly in this city.',
    mistakes: [{ wrong: ['people is'], right: ['people are'], label: 'people is → people are' }],
  },
  {
    say: 'Can you explain me how it works?',
    mistakes: [
      { wrong: ['explain me'], right: ['explain to me'], label: 'explain me → explain to me' },
    ],
  },
  {
    say: 'I take the bus to go to the work every day.',
    mistakes: [
      { wrong: ['to the work'], right: ['to work every'], label: 'to the work → to work' },
    ],
  },
  {
    say: 'He said me that the informations were wrong.',
    mistakes: [
      { wrong: ['said me'], right: ['told me', 'said to me'], label: 'said me → told me' },
      {
        wrong: ['informations'],
        right: ['information was', 'information were'],
        label: 'informations → information',
      },
    ],
  },
  {
    say: 'I didn’t went to the party last night.',
    mistakes: [
      {
        wrong: ["didn't went", 'did not went'],
        right: ["didn't go", 'did not go'],
        label: 'didn’t went → didn’t go',
      },
    ],
  },
  {
    say: 'We discussed about the problem during the meeting.',
    mistakes: [
      {
        wrong: ['discussed about'],
        right: ['discussed the problem'],
        label: 'discussed about → discussed',
      },
    ],
  },
  {
    say: 'It depends of the weather tomorrow.',
    mistakes: [{ wrong: ['depends of'], right: ['depends on'], label: 'depends of → depends on' }],
  },
  {
    say: 'I must to finish this report before Friday.',
    mistakes: [{ wrong: ['must to finish'], right: ['must finish'], label: 'must to → must' }],
  },
];
