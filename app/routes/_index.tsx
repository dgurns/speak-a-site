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
import { useFetcher } from '@remix-run/react';

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
	const existingHTML = formData.get('html') as string;

	const blob = formData.get('audio') as Blob;
	const buffer = await blob.arrayBuffer();
	const transcriptionRes = await ai.run('@cf/openai/whisper', {
		audio: [...new Uint8Array(buffer)],
	});

	const messages = [
		{
			role: 'system',
			content: `You are the world's best frontend engineer and an expert in HTML and CSS.
				Given input HTML and guidance, you are to update the input HTML based on the guidance.
				Don't make any other changes beyond what is requested. 
				Return the updated HTML within these tags: <OUTPUT> updated html goes here </OUTPUT>`,
		},
		{
			role: 'user',
			content: `Update this input HTML using the provided guidance.
				<INPUT>${existingHTML}</INPUT>
				<GUIDANCE>${transcriptionRes.text ?? 'None'}</GUIDANCE>
			`,
		},
	];
	console.log('messages', messages);
	const llmRes = await ai.run('@cf/mistral/mistral-7b-instruct-v0.1', {
		stream: false,
		messages,
	});
	if (llmRes instanceof ReadableStream) {
		throw new Error('LLM returned unexpected streaming response');
	}
	const updatedHTML = llmRes.response ?? '';
	const start = updatedHTML.indexOf('<OUTPUT>');
	const end = updatedHTML.lastIndexOf('</OUTPUT>');
	const cleanedStart = start === -1 ? 0 : start + 8;
	const cleanedEnd = end === -1 ? updatedHTML.length : end;
	const parsedHTML = updatedHTML.substring(cleanedStart, cleanedEnd);
	console.log('parsedHTML', parsedHTML);

	return json({ html: parsedHTML });
}

export default function Home() {
	const fetcher = useFetcher<typeof action>();
	const isLoading = fetcher.state !== 'idle';
	const html = fetcher.data
		? fetcher.data.html
		: `<html>
				<head>
					<style>
						html, body {
							height: 100%;
							width: 100%;
							margin: 0;
							padding: 0;
						}
						.container {
							display: flex;
							flex-direction: row;
							justify-content: center;
							align-items: center;
							height: 100%;
							width: 100%;
						}
					</style>
				</head>
				<body>
					<div class="container">
						<h1>Go ahead, what would you like to change?</h1>
					<div>
				<body>
			</html>`;

	return (
		<div id="container">
			<iframe title="Dynamic Content" id="dynamic-content" srcDoc={html} />
			<div id="cta">
				{isLoading ? (
					'Generating...'
				) : (
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
				)}
			</div>
		</div>
	);
}
