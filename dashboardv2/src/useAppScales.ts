import * as React from 'react';
import useClient from './useClient';
import { setNameFilters, setStreamCreates, setStreamUpdates, RequestModifier } from './client';
import { ScaleRequest, StreamScalesRequest, StreamScalesResponse } from './generated/controller_pb';

const emptyReqModifiersArray = [] as RequestModifier<StreamScalesRequest>[];

export default function useAppScales(
	appName: string,
	enabled: boolean = false,
	reqModifiers: RequestModifier<StreamScalesRequest>[]
) {
	const client = useClient();
	const [loading, setLoading] = React.useState(enabled);
	const [scales, setScales] = React.useState<ScaleRequest[]>([]);
	const [error, setError] = React.useState<Error | null>(null);
	const [nextPageToken, setNextPageToken] = React.useState('');
	if (reqModifiers.length === 0) {
		reqModifiers = emptyReqModifiersArray;
	}
	React.useEffect(
		() => {
			if (!enabled) {
				return;
			}

			const cancel = client.streamScales(
				(res: StreamScalesResponse, error: Error | null) => {
					if (error) {
						setError(error);
						return;
					}
					setScales(res.getScaleRequestsList());
					setNextPageToken(res.getNextPageToken());
					setLoading(false);
					setError(null);
				},
				setNameFilters(appName),
				setStreamCreates(),
				setStreamUpdates(),
				...reqModifiers
			);
			return cancel;
		},
		[appName, enabled, client, reqModifiers]
	);
	return {
		loading,
		scales,
		nextPageToken,
		error
	};
}
