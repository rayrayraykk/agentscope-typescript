/* eslint-disable jsdoc/require-jsdoc */

import { parseNDJSON } from './http-transport';

describe('parseNDJSON', () => {
    test('parses chunked CRLF records and a final record without a newline', async () => {
        const stream = byteStream(['{"first":', '1}\r\n\r\n{"second":2}']);

        expect(await collect(parseNDJSON(stream))).toEqual([{ first: 1 }, { second: 2 }]);
    });

    test('rejects JSON values that are not objects', async () => {
        await expect(collect(parseNDJSON(byteStream(['[1,2,3]\n'])))).rejects.toThrow(
            'Streaming data must contain a JSON object.'
        );
    });
});

function byteStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
        start(controller) {
            for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
            controller.close();
        },
    });
}

async function collect(
    values: AsyncIterable<Record<string, unknown>>
): Promise<Record<string, unknown>[]> {
    const output: Record<string, unknown>[] = [];
    for await (const value of values) output.push(value);
    return output;
}
