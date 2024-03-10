import type {
	MetaFunction,
	LinksFunction,
	ActionFunctionArgs,
} from '@remix-run/cloudflare';
import {
	json,
	unstable_createMemoryUploadHandler,
	unstable_parseMultipartFormData,
} from '@remix-run/cloudflare';
import { Ai } from '@cloudflare/ai';
import styles from '~/styles/index.css?url';
import RecordButton from '~/components/RecordButton';
import { useFetcher, useActionData } from '@remix-run/react';

export const links: LinksFunction = () => {
	return [{ rel: 'stylesheet', href: styles }];
};

export const meta: MetaFunction = () => {
	return [
		{ title: 'Speak a Site' },
		{
			name: 'description',
			content: 'Speaking the web into existence using the magic of LLMs',
		},
	];
};

export async function action({ request, context }: ActionFunctionArgs) {
	const ai = new Ai(context.cloudflare.env.AI);

	const uploadHandler = unstable_createMemoryUploadHandler({
		maxPartSize: 500_000,
	});
	const formData = await unstable_parseMultipartFormData(
		request,
		uploadHandler
	);
	const html = formData.get('html') as string;

	const blob = formData.get('audio') as Blob;
	const buffer = await blob.arrayBuffer();
	const transcriptionRes = await ai.run('@cf/openai/whisper', {
		audio: [...new Uint8Array(buffer)],
	});

	const messages = [
		{
			role: 'system',
			content: `You are the world's best frontend engineer and an expert in HTML and CSS.
				Given existing HTML and guidance, you are to update the existing HTML based on the guidance. 
				Return only the updated HTML.`,
		},
		{
			role: 'user',
			content: `Update this existing HTML using the provided guidance:
					<existing-html>
					${html}
					</existing-html>

					<guidance>
					${transcriptionRes.text ?? 'None'}
					</guidance>
				`,
		},
	];
	console.log('messages', messages);
	const llmRes = await ai.run('@cf/mistral/mistral-7b-instruct-v0.1', {
		stream: false,
		messages,
	});
	console.log('llmRes', llmRes);
	if (llmRes instanceof ReadableStream) {
		throw new Error('LLM returned unexpected streaming response');
	}

	return json({ html: llmRes.response ?? '' });
}

export default function Index() {
	const fetcher = useFetcher();

	const data = useActionData<typeof action>();
	const html = data?.html ?? '';
	console.log('html', html);

	return (
		<div id="container">
			<div
				id="dynamic-content"
				key={html}
				dangerouslySetInnerHTML={{ __html: html }}
			/>
			<div id="cta">
				<RecordButton
					onRecordingComplete={(blob) => {
						const formData = new FormData();
						formData.append('html', html);
						formData.append('audio', blob);
						fetcher.submit(formData, {
							method: 'POST',
							encType: 'multipart/form-data',
						});
					}}
				/>
			</div>
		</div>
	);
}
