import { describe, expect, it } from 'vitest';
import {
  composePose,
  envelope,
  GESTURES,
  GesturePlayer,
  idlePose,
  sampleGesture,
  SPECS,
  walkPose,
} from '../src/scene/gestures';
import { AGREE_RE, FIST_RE, GestureDirector, LAUGH_RE } from '../src/scene/director';
import { CAST, castMember, SCENES, sceneInfo } from '../src/cast';
import { buildSystemPrompt, CHARACTERS, type SceneId } from '../src/teaching/persona';
import { debriefSystemPrompt } from '../src/analysis/prompts';
import { upgradeTalk, type SavedTalk } from '../src/storage/talks';
import type { GestureName } from '../src/scene/gestures';
import { VOICES } from '../src/settings';

describe('gestures', () => {
  it('fade in and out: no jump at the start or the end', () => {
    for (const g of GESTURES) {
      const s = SPECS[g];
      expect(sampleGesture(g, 0).weight).toBe(0);
      expect(sampleGesture(g, s.duration).weight).toBe(0);
      expect(sampleGesture(g, 0.01).weight).toBeLessThan(0.05);
      expect(sampleGesture(g, s.duration - 0.01).weight).toBeLessThan(0.05);
      expect(sampleGesture(g, s.duration / 2).weight).toBeGreaterThan(0.9);
    }
  });
  it('envelope is 0 outside, 1 in the middle', () => {
    expect(envelope(-1, 2, 0.5, 0.5)).toBe(0);
    expect(envelope(1, 2, 0.5, 0.5)).toBe(1);
    expect(envelope(3, 2, 0.5, 0.5)).toBe(0);
  });
  it('wave raises the right arm above the idle pose', () => {
    const idle = idlePose(0, 0);
    const pose = composePose(idle, [sampleGesture('wave', 1.2)]);
    expect(pose.rightUpperArm![2]).toBeGreaterThan(idle.rightUpperArm![2] + 0.5);
    // Left arm untouched.
    expect(pose.leftUpperArm).toEqual(idle.leftUpperArm);
  });
  it('nod moves the head down and is additive', () => {
    expect(SPECS.nod.additive).toBe(true);
    const f = sampleGesture('nod', 0.17);
    expect(f.add.head![0]).toBeGreaterThan(0);
  });
  it('think looks up and aside; reduced amplitude halves it', () => {
    const full = sampleGesture('think', 1.3, 1);
    const half = sampleGesture('think', 1.3, 0.5);
    expect(full.gaze[1]).toBeGreaterThan(0);
    expect(half.gaze[1]).toBeCloseTo(full.gaze[1] / 2);
  });
  it('laugh shows a happy face', () => {
    expect(sampleGesture('laugh', 1).expressions.happy).toBeGreaterThan(0.5);
  });
  it('walk swings the legs in opposition and fades with its weight', () => {
    const w = walkPose(Math.PI / 2, 1).pose;
    expect(Math.sign(w.leftUpperLeg![0])).toBe(-Math.sign(w.rightUpperLeg![0]));
    expect(walkPose(Math.PI / 2, 0).pose.leftUpperLeg![0]).toBe(0);
  });
  it('a new body gesture cuts the previous one; a nod stacks', () => {
    const p = new GesturePlayer();
    p.play('wave', 0);
    p.play('nod', 0.5);
    p.play('laugh', 1);
    expect(p.active).toEqual(['wave', 'nod', 'laugh']);
    expect(p.busy(1.1)).toBe(true);
    const frames = p.frames(1.5); // wave fully cut after 0.3 s
    expect(p.active).toEqual(['nod', 'laugh']);
    expect(frames).toHaveLength(2);
    p.frames(10);
    expect(p.active).toEqual([]);
    expect(p.busy(10)).toBe(false);
  });
});

describe('gesture director', () => {
  const make = (fistBump = true) => {
    const played: GestureName[] = [];
    const d = new GestureDirector({ fistBump, random: () => 0 }, (g) => played.push(g));
    return { d, played };
  };
  it('waves when the talk starts and when it stops', () => {
    const { d, played } = make();
    d.talkStarted(0);
    d.talkStopped(1);
    expect(played).toEqual(['wave', 'wave']);
  });
  it('nods while the learner keeps talking, not at once', () => {
    const { d, played } = make();
    for (let t = 0; t < 1.5; t += 0.032) d.learnerFrame(t, true);
    expect(played).toEqual([]);
    for (let t = 1.5; t < 6; t += 0.032) d.learnerFrame(t, true);
    expect(played.filter((g) => g === 'nod').length).toBeGreaterThanOrEqual(1);
    expect(played.filter((g) => g === 'nod').length).toBeLessThanOrEqual(2);
  });
  it('does not nod while the character speaks', () => {
    const { d, played } = make();
    d.buddyStarts();
    for (let t = 0; t < 6; t += 0.032) d.learnerFrame(t, true);
    expect(played).toEqual([]);
  });
  it('thinks after a long learner turn (at most every 20 s)', () => {
    const { d, played } = make();
    for (let t = 0; t < 5; t += 0.032) d.learnerFrame(t, true);
    played.length = 0;
    for (let t = 5; t < 5.6; t += 0.032) d.learnerFrame(t, false);
    expect(played).toEqual(['think']);
    for (let t = 6; t < 11; t += 0.032) d.learnerFrame(t, true);
    for (let t = 11; t < 12; t += 0.032) d.learnerFrame(t, false);
    expect(played.filter((g) => g === 'think')).toHaveLength(1);
  });
  it('laughs once per turn on "haha", fist-bumps only if the character does', () => {
    const { d, played } = make(true);
    d.buddyStarts();
    d.buddySays('Ha', 10);
    d.buddySays('ha, that is so funny', 10.2);
    d.buddySays(' haha', 10.4);
    expect(played).toEqual(['laugh']);
    d.buddyStarts();
    d.buddySays('You nailed it!', 20);
    expect(played).toEqual(['laugh', 'fistBump']);
    const other = make(false);
    other.d.buddyStarts();
    other.d.buddySays('You nailed it!', 20);
    expect(other.played).toEqual([]);
  });
  it('nods on a strong agreement and waves when the learner says goodbye', () => {
    const { d, played } = make();
    d.buddyStarts();
    d.buddySays('Exactly, ', 1);
    d.learnerSays('Okay I have to go, bye', 10);
    expect(played).toEqual(['nod', 'wave']);
  });
  it('recognises laughs and wins', () => {
    expect(LAUGH_RE.test('Haha, no way')).toBe(true);
    expect(LAUGH_RE.test('ha ha!')).toBe(true);
    expect(LAUGH_RE.test('That was a hard day')).toBe(false);
    expect(LAUGH_RE.test('Hawaii')).toBe(false);
    expect(FIST_RE.test('Deal! See you Friday')).toBe(true);
    expect(FIST_RE.test('a big deal for me')).toBe(false);
    expect(AGREE_RE.test("That's right.")).toBe(true);
  });
});

describe('cast and scenes', () => {
  it('has Jake at the café, Emma at the office, Maya in the street', () => {
    expect(sceneInfo('cafe').host).toBe('jake');
    expect(sceneInfo('office').host).toBe('emma');
    expect(sceneInfo('street').host).toBe('maya');
    expect(castMember('emma').character.accent).toBe('british');
    expect(castMember('nobody').id).toBe('jake');
  });
  it('gives every character a known voice, a model and a prompt for every scene', () => {
    for (const c of CAST) {
      expect(VOICES as readonly string[]).toContain(c.voice);
      expect(c.model).toMatch(/\.vrm$/);
      for (const s of SCENES) {
        const p = buildSystemPrompt(c.character, undefined, s.id as SceneId);
        expect(p).toContain(`You are ${c.character.name}`);
        expect(p).toContain(c.character.scenes[s.id]);
        expect(p).toMatch(/Recast/);
        expect(p).toContain(`carry on as ${c.character.name}`);
      }
    }
  });
  it('asks the British characters for British English', () => {
    for (const id of ['emma', 'ollie'] as const) {
      expect(buildSystemPrompt(CHARACTERS[id])).toMatch(/British accent/);
    }
    expect(buildSystemPrompt(CHARACTERS.maya)).toMatch(/American accent/);
  });
  it('describes the right character to the debrief', () => {
    const p = debriefSystemPrompt({
      level: 'B1',
      characterName: 'Emma',
      characterDescription: CHARACTERS.emma.shortDescription,
      transcriptSource: 'Gemini Live',
    });
    expect(p).toContain('British team manager');
    expect(p).not.toContain('American friend');
  });
});

describe('saved talks from phase 1', () => {
  it('are read with the phase 2 names', () => {
    const old = {
      id: 't',
      startedAt: 1,
      durationMs: 1,
      label: '',
      turns: [{ id: 1, who: 'jake', text: 'Hi', liveText: 'Hi', source: 'live' }],
      debrief: {
        summaryFr: '',
        strengthsFr: [],
        mistakes: [
          {
            turn: 2,
            type: 'other',
            said: 'a',
            correct: 'b',
            explanationFr: '',
            recastByJake: true,
          },
        ],
        vocabulary: [],
        nextFocusFr: '',
        model: 'm',
      },
      why: {},
    } as unknown as SavedTalk;
    const t = upgradeTalk(old);
    expect(t.turns[0].who).toBe('buddy');
    expect(t.character).toBe('jake');
    expect(t.scene).toBe('cafe');
    expect(t.debrief!.mistakes[0].recastByCharacter).toBe(true);
  });
});
