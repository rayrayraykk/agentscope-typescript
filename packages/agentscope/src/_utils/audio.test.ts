import { _buildStreamingWavHeader, _buildWav } from './audio';

describe('_buildStreamingWavHeader', () => {
    test('matches the Python default 44-byte WAV header', () => {
        expect(Buffer.from(_buildStreamingWavHeader()).toString('hex')).toBe(
            '52494646ffffffff57415645666d74201000000001000100c05d000080bb00000200100064617461ffffffff'
        );
    });

    test('writes custom PCM parameters in little-endian form', () => {
        const header = _buildStreamingWavHeader(16_000, 2, 24);
        const view = new DataView(header.buffer, header.byteOffset, header.byteLength);

        expect(header).toHaveLength(44);
        expect(view.getUint16(22, true)).toBe(2);
        expect(view.getUint32(24, true)).toBe(16_000);
        expect(view.getUint32(28, true)).toBe(96_000);
        expect(view.getUint16(32, true)).toBe(6);
        expect(view.getUint16(34, true)).toBe(24);
    });
});

describe('_buildWav', () => {
    test('writes finite RIFF and data sizes around the PCM payload', () => {
        const wav = _buildWav(Buffer.from('AUDIO'), 16_000, 2, 16);
        const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

        expect(wav).toHaveLength(49);
        expect(Buffer.from(wav.subarray(0, 4)).toString()).toBe('RIFF');
        expect(view.getUint32(4, true)).toBe(41);
        expect(view.getUint32(40, true)).toBe(5);
        expect(Buffer.from(wav.subarray(44)).toString()).toBe('AUDIO');
    });
});
