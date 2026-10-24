import type { Case, Span } from './pipeline';

// ponytail: transformation plans are hand-authored stand-ins for Haiku output; swap for a live API call when connected.
type RawSpan = Omit<Span, 'id'>;
const S = (match: string, to: string, type: string, method: string, by: Span['by'], why: string, review?: string): RawSpan =>
  ({ match, to, type, method, by, why, review });
const withIds = (c: Omit<Case, 'spans'> & { spans: RawSpan[] }): Case =>
  ({ ...c, spans: c.spans.map((s, i) => ({ ...s, id: `${c.id}${i + 1}` })) });

export const CASES: Case[] = [
  withIds({
    id: 'A',
    label: 'A · Post-divorce insomnia',
    summary: 'A night-shift nurse describes sleep loss and pre-shift anxiety after a divorce. The case shows how names, an employer, a city, a date, a phone number, and family members are handled.',
    turns: [
      ['counselor', "Thanks for coming in. What's been going on?"],
      ['client', "I'm Megan Brooks. I work nights as an ICU nurse at St. Agnes Medical Center in Fresno. Since my divorce from Daniel was finalized on March 3, I've barely been sleeping."],
      ['counselor', 'That sounds exhausting. How long has your sleep been this disrupted?'],
      ['client', "About six weeks. Before every night shift my chest gets tight, and I keep worrying I'll make a mistake with a patient."],
      ['counselor', 'Is there anyone you can lean on right now?'],
      ['client', 'My sister Rachel checks in on me. If an earlier slot opens up, text me at (559) 555-0142.'],
    ],
    spans: [
      S('Megan Brooks', '[Client A]', 'Name · client', 'Pseudonymize', 'Model proposal', 'A direct identifier. A stable role token keeps the speaker trackable without the name.'),
      S('an ICU nurse', 'a nurse', 'Occupation · specific unit', 'Generalize', 'Model proposal', 'A unit-level role combined with an employer narrows down the person. "Nurse" keeps the shift-work context that the evaluation needs.'),
      S('St. Agnes Medical Center', 'a hospital', 'Employer · named facility', 'Generalize', 'Model proposal', 'A named facility is a quasi-identifier. The facility type keeps the occupational setting.'),
      S('Fresno', 'California', 'Location · city', 'Generalize', 'Model proposal', 'HIPAA Safe Harbor removes geography smaller than a state. The state is kept for context.'),
      S('Daniel', '[Ex-spouse B]', 'Name · family member', 'Pseudonymize', 'Model proposal', "Relatives' names can identify the client too. The role token keeps who the divorce involved."),
      S('on March 3', 'about six weeks ago', 'Date · exact', 'Relative time', 'Model proposal', 'Exact dates are removed. A reviewed relative time keeps the divorce before the onset of the sleep problem.'),
      S('Rachel', '[Sister C]', 'Name · family member', 'Pseudonymize', 'Model proposal', 'Keeps the support relationship and drops the name.'),
      S('(559) 555-0142', '[PHONE]', 'Phone number', 'Mask', 'Format rule', 'Contact details carry no evaluation value.'),
    ],
    anchors: ['work nights', 'divorce', 'barely been sleeping', 'About six weeks', 'my chest gets tight', "I'll make a mistake with a patient", 'checks in on me'],
    context: [
      ['Trigger: the divorce comes before the sleep problem', 'preserved', 'The event and the order are kept. The exact date became a relative time.'],
      ['Symptom and duration: insomnia for about six weeks', 'preserved', 'Unchanged.'],
      ['Anxiety before night shifts and fear of patient error', 'preserved', 'Unchanged.'],
      ['Occupation: night-shift healthcare worker', 'preserved', 'The unit and facility are generalized. The role category is kept.'],
      ['Support: a sister checks in', 'preserved', 'The relationship is kept through a role pseudonym.'],
    ],
    dims: [
      ['Empathic response', 'Exhaustion and fear of harming a patient call for validation before advice.'],
      ['Follow-up questioning', 'Sleep duration and pre-shift anxiety invite specific, well-timed questions.'],
      ['Occupational stress awareness', 'Shift work and patient-safety worry are kept so the model can address them.'],
      ['Support exploration', 'The sister relationship is still available for strengths-based responses.'],
    ],
  }),
  withIds({
    id: 'B',
    label: 'B · Family conflict & panic',
    summary: 'A young adult describes conflict with a parent, near-nightly panic, and a safety check. The case shows consistent pseudonyms across turns, a generalized school name, and a rare-event span routed to human review.',
    turns: [
      ['counselor', 'Last week you said things were tense at home. How has this week been?'],
      ['client', "Worse. My dad, Robert, found out I dropped out of Lakeview Community College, and he hasn't spoken to me since."],
      ['counselor', 'That sounds painful. How have you been handling it?'],
      ['client', "I've had panic attacks almost every night. My brother Kevin says Robert will come around, but Kevin always takes his side."],
      ['counselor', 'It sounds like you feel caught between them. Do you feel safe at home?'],
      ['client', "I'm safe, I just don't want to be there. My dad was the fire chief on the news after the Oakridge warehouse fire, so everyone in town knows our family."],
    ],
    spans: [
      S('Robert', '[Father B]', 'Name · family member', 'Pseudonymize', 'Model proposal', 'The same person gets the same token in every turn, so the conflict stays easy to follow.'),
      S('Lakeview Community College', 'community college', 'Institution · named school', 'Generalize', 'Model proposal', 'A named school narrows down the location and cohort. The school type keeps the trigger.'),
      S('Kevin', '[Brother C]', 'Name · family member', 'Pseudonymize', 'Model proposal', "A consistent token keeps it clear across turns that the sibling takes the father's side."),
      S('was the fire chief on the news after the Oakridge warehouse fire', 'has a well-known public role locally', 'Rare event + unique role', 'Generalize · flagged', 'Model proposal',
        'A named local incident combined with a one-of-a-kind role can single out the family. The generalization keeps the sense of public visibility.',
        'Whether this still narrows down the family is a human judgment. It is not auto-approved and is not a safety verdict.'),
    ],
    anchors: ["hasn't spoken to me since", 'dropped out of', 'panic attacks almost every night', 'takes his side', 'caught between them', "I'm safe", "I just don't want to be there", 'everyone in town knows our family'],
    context: [
      ['Trigger: the father withdrew after the client left college', 'preserved', 'The school is generalized. The event and its consequence are kept.'],
      ['Symptom and frequency: panic attacks almost every night', 'preserved', 'Unchanged.'],
      ['Relationships: the brother sides with the father', 'preserved', 'The same tokens are used in turns 2 and 4.'],
      ['Safety: the client says they are safe but wants distance from home', 'preserved', 'The negation is kept exactly. The meaning was not flipped or softened.'],
      ['Social visibility: the family is publicly known locally', 'unclear', 'This is kept in a general form. Whether it still identifies the family is under review.'],
    ],
    dims: [
      ['Risk-signal recognition', `A safety question with a negated answer tests whether a model reads "I'm safe" correctly, without ignoring distress or overreacting.`],
      ['Empathic response', 'The client faces rejection by a parent and feels caught in the middle.'],
      ['Family-systems follow-up', 'Three people in one conflict invite questions about each of them.'],
      ['Entity tracking', 'Stable pseudonyms let a model follow who did what across turns.'],
    ],
  }),
];
