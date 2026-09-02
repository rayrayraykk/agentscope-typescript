/* eslint-disable jsdoc/require-description, jsdoc/require-returns */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
    AnthropicChatFormatter,
    AnthropicMultiAgentFormatter,
    FormatterBase,
} from '../../src/formatter';
import { Msg, parseMsg } from '../../src/message';

interface GoldenFixture {
    python_commit: string;
    chat_messages: unknown[];
    multi_messages: unknown[];
    outputs: Record<string, unknown>;
}

const fixturePath = path.join(__dirname, 'fixtures/formatter.python.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as GoldenFixture;

describe('Python formatter golden fixture', () => {
    test('is tied to the pinned Python source commit', () => {
        expect(fixture.python_commit).toBe('de163b34b909edaba3c174190ad7e1a355e7849f');
    });

    test.each(formatterCases())(
        '%s matches Python output exactly',
        async (name, formatter, msgs) => {
            const output = await formatter.format({ msgs });
            expect(normalizeTempPaths(output)).toEqual(fixture.outputs[name]);
        }
    );
});

/**
 *
 */
function formatterCases(): Array<[string, FormatterBase, Msg[]]> {
    const chat = fixture.chat_messages.map(parseMsg);
    const multi = fixture.multi_messages.map(parseMsg);
    return [
        ['anthropic_chat', new AnthropicChatFormatter(), chat],
        ['anthropic_multi', new AnthropicMultiAgentFormatter(), multi],
    ];
}

/**
 *
 * @param value
 */
function normalizeTempPaths<T>(value: T): T {
    return JSON.parse(
        JSON.stringify(value).replace(
            /saved locally at: [^<]+(?=\.<\/system-reminder>)/g,
            'saved locally at: <TEMP_FILE>'
        )
    ) as T;
}
