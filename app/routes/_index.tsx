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
import { useFetcher, useRouteError } from '@remix-run/react';

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

	// Transcribe the audio to figure out what the user wants to change
	const blob = formData.get('audio') as Blob;
	const buffer = await blob.arrayBuffer();
	const transcriptionRes = await ai.run('@cf/openai/whisper', {
		audio: [...new Uint8Array(buffer)],
	});
	const transcriptionText = transcriptionRes.text;
	console.log('Transcription generated:', transcriptionText);

	// Ask the LLM to generate updated HTML
	const messages = [
		{
			role: 'system',
			content: `You are the world's best frontend engineer, most talented designer, and an expert in HTML and CSS.
				Given input HTML and guidance, you are to update the input HTML based on the guidance.
				Return only the updated HTML.`,
		},
		{
			role: 'user',
			content: `Update this input HTML using the provided guidance.
				<INPUT>${existingHTML}</INPUT>
				<GUIDANCE>${transcriptionText ?? 'None'}</GUIDANCE>
			`,
		},
	];
	const llmRes = await ai.run('@cf/meta/llama-2-7b-chat-int8', {
		stream: false,
		messages,
		max_tokens: 1000,
	});
	if (llmRes instanceof ReadableStream) {
		throw new Error('LLM returned unexpected streaming response');
	}
	const updatedHTML = llmRes.response ?? '';
	console.log('Updated HTML generated by LLM:', updatedHTML);

	// Parse the relevant HTML out of the LLM's response
	const start = updatedHTML.indexOf('<html>');
	const end = updatedHTML.lastIndexOf('</html>');
	const cleanedStart = start === -1 ? 0 : start;
	const cleanedEnd = end === -1 ? updatedHTML.length : end + 7;
	const parsedHTML = updatedHTML.substring(cleanedStart, cleanedEnd);
	console.log('Parsed HTML:', parsedHTML);

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
							padding: 20px;
						}
					</style>
				</head>
				<body>
					<div>
						<h1>Go ahead, what would you like to change?</h1>
						<div>Try "Make the background red" or "Add a section about dogs"</div>
					<div>
				<body>
			</html>`;

	return (
		<div className="container">
			<iframe title="Dynamic Content" id="dynamic-content" srcDoc={html} />
			<div id="cta">
				{isLoading ? (
					<div className="loading">Generating...</div>
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

export function ErrorBoundary() {
	const error = useRouteError();
	return (
		<div className="container">
			<h1>Something went wrong</h1>
			<p>{error instanceof Error ? error.message : ''}</p>
			<a href="/">Try again</a>
		</div>
	);
}
