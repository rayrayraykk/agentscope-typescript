import {
    COSYVOICE_TTS_PARAMETER_SCHEMA,
    DASHSCOPE_TTS_PARAMETER_SCHEMA,
    GEMINI_TTS_PARAMETER_SCHEMA,
    OPENAI_TTS_PARAMETER_SCHEMA,
    ttsModelOrder,
    ttsParameterSchema,
} from './schemas';

describe('TTS parameter schema parity', () => {
    test('selects the provider-specific schema', () => {
        expect(ttsParameterSchema('openai', 'tts-1')).toBe(OPENAI_TTS_PARAMETER_SCHEMA);
        expect(ttsParameterSchema('gemini', 'gemini-2.5-pro-preview-tts')).toBe(
            GEMINI_TTS_PARAMETER_SCHEMA
        );
        expect(ttsParameterSchema('dashscope', 'qwen3-tts-flash')).toBe(
            DASHSCOPE_TTS_PARAMETER_SCHEMA
        );
        expect(ttsParameterSchema('dashscope', 'cosyvoice-v3-plus')).toBe(
            COSYVOICE_TTS_PARAMETER_SCHEMA
        );
    });

    test('returns an empty schema for unknown providers', () => {
        expect(ttsParameterSchema('unknown', 'model')).toEqual({
            type: 'object',
            properties: {},
            required: [],
        });
    });

    test('preserves Python model ordering and sorts unknown models last', () => {
        expect([
            ttsModelOrder('dashscope', 'qwen3-tts-flash'),
            ttsModelOrder('dashscope', 'qwen3-tts-flash-realtime'),
            ttsModelOrder('dashscope', 'cosyvoice-v3-flash'),
            ttsModelOrder('dashscope', 'cosyvoice-v3-plus'),
            ttsModelOrder('dashscope', 'unknown'),
        ]).toEqual([0, 1, 2, 3, Number.MAX_SAFE_INTEGER]);
    });
});
