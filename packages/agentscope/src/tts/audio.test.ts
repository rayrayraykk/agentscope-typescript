/* eslint-disable jsdoc/require-jsdoc */

import { audioResponse, concatBytes, pcmWavResponse, streamingWavDelta } from './audio';

describe('TTS audio helpers', () => {
    test('encodes provider bytes as a base64 data block', () => {
        expect(audioResponse(Buffer.from('AUDIO'), 'audio/mpeg', false).toJSON()).toEqual({
            content: {
                id: expect.any(String),
                name: null,
                created_at: expect.any(String),
                finished_at: null,
                source: {
                    data: 'QVVESU8=',
                    media_type: 'audio/mpeg',
                    type: 'base64',
                },
                type: 'data',
            },
            id: expect.any(String),
            created_at: expect.any(String),
            type: 'tts',
            usage: null,
            metadata: null,
            is_last: false,
        });
    });

    test('wraps complete PCM and only prefixes the first stream delta', () => {
        const complete = decode(pcmWavResponse(Buffer.from('PCM')));
        expect(complete.subarray(0, 4).toString()).toBe('RIFF');
        expect(complete.subarray(44).toString()).toBe('PCM');

        expect(
            Buffer.from(streamingWavDelta(Buffer.from('ONE'), true))
                .subarray(44)
                .toString()
        ).toBe('ONE');
        expect(Buffer.from(streamingWavDelta(Buffer.from('TWO'), false)).toString()).toBe('TWO');
    });

    test('concatenates byte chunks in order', () => {
        expect(Buffer.from(concatBytes([Buffer.from('ONE'), Buffer.from('TWO')])).toString()).toBe(
            'ONETWO'
        );
    });
});

function decode(response: ReturnType<typeof pcmWavResponse>): Buffer {
    const source = response.content?.source;
    if (!source || source.type !== 'base64') throw new Error('Expected base64 audio.');
    return Buffer.from(source.data, 'base64');
}
