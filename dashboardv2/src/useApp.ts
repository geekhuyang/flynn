import * as React from 'react';
import useClient from './useClient';
import { setNameFilters, setPageSize, setStreamUpdates } from './client';
import { App, StreamAppsResponse } from './generated/controller_pb';

export default function useApp(appName: string) {
	const client = useClient();
	const [appLoading, setAppLoading] = React.useState(true);
	const [app, setApp] = React.useState<App | null>(null);
	const [error, setError] = React.useState<Error | null>(null);
	React.useEffect(
		() => {
			// no-op if called with empty appName
			if (appName === '') return () => {};

			const cancel = client.streamApps(
				(res: StreamAppsResponse, error: Error | null) => {
					setAppLoading(false);
					if (error) {
						setError(error);
						return;
					}
					const app = res.getAppsList()[0];
					if (app) {
						setApp(app);
					} else {
						setError(new Error('App not found'));
					}
				},
				setNameFilters(appName),
				setPageSize(1),
				setStreamUpdates()
			);
			return cancel;
		},
		[appName, client]
	);
	return {
		loading: appLoading,
		app,
		error
	};
}
