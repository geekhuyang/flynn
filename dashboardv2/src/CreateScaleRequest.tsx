import * as React from 'react';
import { Box, Button } from 'grommet';
import { Checkmark as CheckmarkIcon } from 'grommet-icons';

import useClient from './useClient';
import useAppScale from './useAppScale';
import useAppRelease from './useAppRelease';
import useCallIfMounted from './useCallIfMounted';
import { ErrorHandler } from './useErrorHandler';
import Loading from './Loading';
import ProcessesDiff from './ProcessesDiff';
import protoMapDiff from './util/protoMapDiff';
import protoMapReplace from './util/protoMapReplace';
import buildProcessesMap from './util/buildProcessesMap';
import { ScaleRequest, CreateScaleRequest } from './generated/controller_pb';

interface Props {
	appName: string;
	nextScale: CreateScaleRequest;
	onCancel: () => void;
	onCreate: (scaleRequest: ScaleRequest) => void;
	handleError: ErrorHandler;
}

export default function CreateScaleRequestComponent({ appName, nextScale, onCancel, onCreate, handleError }: Props) {
	const client = useClient();
	const callIfMounted = useCallIfMounted();
	const { scale, loading: scaleLoading, error: scaleError } = useAppScale(appName);
	const { release, loading: releaseLoading, error: releaseError } = useAppRelease(appName);
	const isLoading = scaleLoading || releaseLoading;
	const [hasChanges, setHasChanges] = React.useState(true);
	const [isCreating, setIsCreating] = React.useState(false);
	const [isScaleToZeroConfirmed, setIsScaleToZeroConfirmed] = React.useState(false);

	React.useEffect(
		() => {
			if (scaleError) {
				handleError(scaleError);
			}
			if (releaseError) {
				handleError(releaseError);
			}
		},
		[scaleError, releaseError, handleError]
	);

	// keep track of if selected scale actually changes anything
	React.useEffect(
		() => {
			const diff = protoMapDiff(
				buildProcessesMap((scale || new ScaleRequest()).getNewProcessesMap(), release),
				buildProcessesMap(nextScale.getProcessesMap(), release)
			);
			setHasChanges(diff.length > 0);
		},
		[nextScale, scale, release]
	);

	function handleSubmit(e: React.SyntheticEvent) {
		e.preventDefault();

		setIsCreating(true);

		const req = new CreateScaleRequest();
		req.setParent(nextScale.getParent() || (release ? release.getName() : ''));
		protoMapReplace(req.getProcessesMap(), nextScale.getProcessesMap());
		protoMapReplace(req.getTagsMap(), nextScale.getTagsMap());
		client.createScale(req, (scaleReq: ScaleRequest, error: Error | null) => {
			callIfMounted(() => {
				if (error) {
					setIsCreating(false);
					handleError(error);
					return;
				}
				onCreate(scaleReq);
			});
		});
	}

	if (isLoading) {
		return <Loading />;
	}

	if (!scale) throw new Error('<CreateScaleRequestComponent> Error: Unexpected lack of scale!');
	if (!release) throw new Error('<CreateScaleRequestComponent> Error: Unexpected lack of release!');

	return (
		<Box tag="form" fill direction="column" onSubmit={handleSubmit} gap="small" justify="between">
			<Box>
				<h3>Review Changes</h3>

				<ProcessesDiff
					wrap
					direction="row"
					margin="small"
					align="center"
					scale={scale}
					nextScale={nextScale}
					release={release}
					onConfirmScaleToZeroChange={(c) => setIsScaleToZeroConfirmed(c)}
				/>
			</Box>

			<Box fill="horizontal" direction="row" align="end" gap="small" justify="between">
				<Button
					type="submit"
					disabled={isCreating || !hasChanges || !isScaleToZeroConfirmed}
					primary
					icon={<CheckmarkIcon />}
					label={isCreating ? 'Scaling App...' : 'Scale App'}
				/>
				<Button
					type="button"
					label="Cancel"
					onClick={(e: React.SyntheticEvent) => {
						e.preventDefault();
						onCancel();
					}}
				/>
			</Box>
		</Box>
	);
}
