import * as React from 'react';
import useClient from './useClient';
import useApp from './useApp';
import { setNameFilters, filterScalesByState, setPageSize, setStreamCreates, setStreamUpdates } from './client';
import { ScaleRequest, ScaleRequestState, StreamScalesResponse } from './generated/controller_pb';

export default function useAppScale(appName: string) {
	const client = useClient();
	const { app, loading: appLoading, error: appError } = useApp(appName);
	const releaseName = app ? app.getRelease() : '';
	const [loading, setLoading] = React.useState(true);
	const [scale, setScale] = React.useState<ScaleRequest | null>(null);
	const [error, setError] = React.useState<Error | null>(null);
	React.useEffect(
		() => {
			if (!releaseName) {
				const scale = new ScaleRequest();
				scale.setState(ScaleRequestState.SCALE_COMPLETE);
				setScale(scale);
				setLoading(false);
				return;
			}
			const cancel = client.streamScales(
				(res: StreamScalesResponse, error: Error | null) => {
					if (error) {
						setError(error);
						return;
					}
					const scales = res.getScaleRequestsList()
					let scale;
					if (scales.length === 0) {
						scale = new ScaleRequest();
						scale.setState(ScaleRequestState.SCALE_COMPLETE);
					} else {
						scale = scales[0];
					}
					setScale(scale);
					setLoading(false);
					setError(null);
				},
				setNameFilters(releaseName),
				filterScalesByState(ScaleRequestState.SCALE_COMPLETE),
				setPageSize(1),
				setStreamCreates(),
				setStreamUpdates()
			);
			return cancel;
		},
		[releaseName, client]
	);
	return {
		loading: appLoading || loading,
		scale,
		error: appError || error
	};
}
