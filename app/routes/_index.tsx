import type { MetaFunction, LinksFunction } from '@remix-run/cloudflare';
import styles from '~/styles/index.css?url';

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

export default function Index() {
	return (
		<div id="container">
			<div id="dynamic-content" dangerouslySetInnerHTML={{ __html: '' }} />
			<div id="cta">
				<button>Record</button>
			</div>
		</div>
	);
}
