import * as React from 'react';
import * as timestamp_pb from 'google-protobuf/google/protobuf/timestamp_pb';
import styled from 'styled-components';

import { Checkmark as CheckmarkIcon } from 'grommet-icons';
import { CheckBox, Button, Box, BoxProps, Text } from 'grommet';

import ifDev from './ifDev';
import ProcessScale from './ProcessScale';
import RightOverlay from './RightOverlay';
import { default as useRouter } from './useRouter';
import useApp from './useApp';
import useReleaseHistory from './useReleaseHistory';
import useAppScale from './useAppScale';
import useErrorHandler from './useErrorHandler';
import { listDeploymentsRequestFilterType, setNameFilters, ReleaseHistoryItem } from './client';
import {
	Release,
	ReleaseType,
	ReleaseTypeMap,
	ScaleRequest,
	CreateScaleRequest,
	ScaleRequestState
} from './generated/controller_pb';
import Loading from './Loading';
import CreateDeployment from './CreateDeployment';
import CreateScaleRequestComponent from './CreateScaleRequest';
import ReleaseComponent from './Release';
import WindowedListState from './WindowedListState';
import WindowedList, { WindowedListItem } from './WindowedList';
import protoMapDiff, { Diff, DiffOp, DiffOption } from './util/protoMapDiff';
import protoMapReplace from './util/protoMapReplace';

interface MapHistoryProps<T> {
	startIndex: number;
	length: number;
	items: ReleaseHistoryItem[];
	renderDate: (key: string, date: Date) => T;
	renderRelease: (key: string, releases: [Release, Release | null], index: number) => T;
	renderScale: (key: string, scaleRequest: ScaleRequest, index: number) => T;
}

function roundedDate(d: Date): Date {
	const out = new Date(d);
	out.setMilliseconds(0);
	out.setSeconds(0);
	out.setMinutes(0);
	out.setHours(0);
	return out;
}

const TODAY = roundedDate(new Date());

function isToday(d: Date): boolean {
	if (d.getFullYear() !== TODAY.getFullYear()) {
		return false;
	}
	if (d.getMonth() !== TODAY.getMonth()) {
		return false;
	}
	if (d.getDate() !== TODAY.getDate()) {
		return false;
	}
	return true;
}

function _last<T>(arr: Array<T>): T {
	return arr[arr.length - 1];
}

function mapHistory<T>({
	startIndex,
	length,
	items,
	renderRelease,
	renderScale,
	renderDate
}: MapHistoryProps<T>): Array<T | null> {
	const res = [] as Array<T | null>;
	const len = Math.min(startIndex + length, items.length);
	let date: Date | null = null;
	for (let i = startIndex; i < len; i++) {
		const item = items[i];
		let prevDate = date;
		let el: T | null = null;
		if (item.isScaleRequest) {
			const s = item.getScaleRequest();
			date = roundedDate((s.getCreateTime() as timestamp_pb.Timestamp).toDate());
			el = renderScale(_last(s.getName().split('/')), s, i);
		} else {
			// it must be a deployment
			const d = item.getDeployment();
			const r = d.getNewRelease() || null;
			const pr = d.getOldRelease() || null;
			date = roundedDate((d.getCreateTime() as timestamp_pb.Timestamp).toDate());
			el = renderRelease(_last(d.getName().split('/')), [r as Release, pr], i);
		}

		if (prevDate === null || date < prevDate) {
			// TODO(jvatic): this should render as a WindowedList sticky item:
			// res.push(renderDate(date.toDateString(), date));
		}

		res.push(el);
	}

	return res;
}

interface SelectableBoxProps {
	selected: boolean;
	highlighted: boolean;
}

const selectedBoxCSS = `
	background-color: var(--active);
`;

const highlightedBoxCSS = `
	border-left: 4px solid var(--brand);
`;

const nonHighlightedBoxCSS = `
	border-left: 4px solid transparent;
`;

const SelectableBox = styled(Box)`
	&:hover {
		background-color: var(--active);
	}
	padding-left: 2px;

	${(props: SelectableBoxProps) => (props.selected ? selectedBoxCSS : '')};
	${(props: SelectableBoxProps) => (props.highlighted ? highlightedBoxCSS : nonHighlightedBoxCSS)};
`;

interface StickyBoxProps {
	top?: string;
	bottom?: string;
}

const StickyBox = styled(Box)`
	position: sticky;
	${(props: StickyBoxProps) => (props.top ? 'top: ' + props.top + ';' : '')} ${(props: StickyBoxProps) =>
		props.bottom ? 'bottom: ' + props.bottom + ';' : ''};
`;

interface ReleaseHistoryDateHeaderProps extends BoxProps {
	date: Date;
}

function ReleaseHistoryDateHeader({ date, ...boxProps }: ReleaseHistoryDateHeaderProps) {
	return (
		<StickyBox top="-1px" {...boxProps}>
			<Box round background="background" alignSelf="center" pad="small">
				{isToday(date) ? 'Today' : date.toDateString()}
			</Box>
		</StickyBox>
	);
}

interface ReleaseHistoryReleaseProps extends BoxProps {
	selected: boolean;
	isCurrent: boolean;
	release: Release;
	prevRelease: Release | null;
	onChange: (isSelected: boolean) => void;
}

const ReleaseHistoryRelease = React.memo(
	React.forwardRef(function ReleaseHistoryRelease(
		{ release: r, prevRelease: p, selected, isCurrent, onChange, ...boxProps }: ReleaseHistoryReleaseProps,
		ref: any
	) {
		return (
			<SelectableBox ref={ref} selected={selected} highlighted={isCurrent} {...boxProps}>
				<label>
					<CheckBox
						checked={selected}
						indeterminate={!selected && isCurrent}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
					/>
					<ReleaseComponent release={r} prevRelease={p} />
				</label>
			</SelectableBox>
		);
	}),
	function areEqual(prevProps: ReleaseHistoryReleaseProps, nextProps: ReleaseHistoryReleaseProps) {
		if (prevProps.selected !== nextProps.selected) return false;
		if (prevProps.isCurrent !== nextProps.isCurrent) return false;
		if (prevProps.release.getName() !== nextProps.release.getName()) return false;
		if ((prevProps.prevRelease || new Release()).getName() !== (nextProps.prevRelease || new Release()).getName()) {
			return false;
		}
		return true;
	}
);
ifDev(() => ((ReleaseHistoryRelease as any).whyDidYouRender = true));

interface ReleaseHistoryScaleProps extends BoxProps {
	selected: boolean;
	isCurrent: boolean;
	scaleRequest: ScaleRequest;
	onChange: (isSelected: boolean) => void;
}

const ReleaseHistoryScale = React.memo(
	React.forwardRef(function ReleaseHistoryScale(
		{ scaleRequest: s, selected, isCurrent, onChange, ...boxProps }: ReleaseHistoryScaleProps,
		ref: any
	) {
		const releaseID = s.getParent().split('/')[3];
		const diff = protoMapDiff(s.getOldProcessesMap(), s.getNewProcessesMap(), DiffOption.INCLUDE_UNCHANGED);
		return (
			<SelectableBox ref={ref} selected={selected} highlighted={isCurrent} {...boxProps}>
				<label>
					<CheckBox
						checked={selected}
						indeterminate={!selected && isCurrent}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
					/>
					<div>
						<div>Release {releaseID}</div>
						<div>
							{(() => {
								switch (s.getState()) {
									case ScaleRequestState.SCALE_PENDING:
										return 'PENDING';
									case ScaleRequestState.SCALE_CANCELLED:
										return 'CANCELED';
									case ScaleRequestState.SCALE_COMPLETE:
										return 'COMPLETE';
									default:
										return 'UNKNOWN';
								}
							})()}
						</div>
						<Box wrap direction="row">
							{diff.length === 0 ? <Text color="dark-2">&lt;No processes&gt;</Text> : null}
							{diff.reduce(
								(m: React.ReactNodeArray, op: DiffOp<string, number>) => {
									if (op.op === 'remove') {
										return m;
									}
									let val = op.value;
									let prevVal = s.getOldProcessesMap().get(op.key);
									if (op.op === 'keep') {
										val = prevVal;
									}
									m.push(
										<ProcessScale
											key={op.key}
											direction="row"
											margin="xsmall"
											size="xsmall"
											value={val as number}
											originalValue={prevVal}
											showDelta
											label={op.key}
										/>
									);
									return m;
								},
								[] as React.ReactNodeArray
							)}
						</Box>
					</div>
				</label>
			</SelectableBox>
		);
	}),
	function areEqual(prevProps: ReleaseHistoryScaleProps, nextProps: ReleaseHistoryScaleProps) {
		if (prevProps.selected !== nextProps.selected) return false;
		if (prevProps.isCurrent !== nextProps.isCurrent) return false;
		if (prevProps.scaleRequest.getName() !== nextProps.scaleRequest.getName()) return false;
		return true;
	}
);
ifDev(() => ((ReleaseHistoryScale as any).whyDidYouRender = true));

export interface Props {
	appName: string;
}

enum SelectedResourceType {
	Release = 1,
	ScaleRequest
}

function ReleaseHistory({ appName }: Props) {
	const handleError = useErrorHandler();
	const [isDeploying, setIsDeploying] = React.useState(false);

	const { app, loading: appLoading, error: appError } = useApp(appName);
	React.useEffect(
		() => {
			if (appError) {
				handleError(appError);
			}
		},
		[appError, handleError]
	);

	const currentReleaseName = app ? app.getRelease() : '';

	const [selectedItemName, setSelectedItemName] = React.useState<string>('');
	React.useEffect(
		() => {
			if (!currentReleaseName) return;
			setSelectedItemName(currentReleaseName);
		},
		[currentReleaseName]
	);

	const { urlParams } = useRouter();
	const releasesListFilters = [urlParams.getAll('rhf'), ['code', 'env', 'scale']].find((i) => i.length > 0) as string[];

	const rhf = releasesListFilters;
	const isCodeReleaseEnabled = React.useMemo(
		() => {
			return rhf.length === 0 || rhf.indexOf('code') !== -1;
		},
		[rhf]
	);
	const isConfigReleaseEnabled = React.useMemo(
		() => {
			return rhf.indexOf('env') !== -1;
		},
		[rhf]
	);
	const isScaleEnabled = React.useMemo(
		() => {
			return rhf.indexOf('scale') !== -1;
		},
		[rhf]
	);

	// Stream release history (scales and deployments coalesced together)
	const streamDeploymentsEnabled = isCodeReleaseEnabled || isConfigReleaseEnabled;
	const deploymentReqModifiers = React.useMemo(
		() => {
			let filterType = ReleaseType.ANY as ReleaseTypeMap[keyof ReleaseTypeMap];
			if (isCodeReleaseEnabled && !isConfigReleaseEnabled) {
				filterType = ReleaseType.CODE;
			} else if (isConfigReleaseEnabled && !isCodeReleaseEnabled) {
				filterType = ReleaseType.CONFIG;
			}

			return [setNameFilters(appName), listDeploymentsRequestFilterType(filterType)];
		},
		[appName, isCodeReleaseEnabled, isConfigReleaseEnabled]
	);
	const { items, loading: releaseHistoryLoading, error: releaseHistoryError } = useReleaseHistory(
		appName,
		[],
		deploymentReqModifiers,
		isScaleEnabled,
		streamDeploymentsEnabled
	);
	React.useEffect(
		() => {
			if (releaseHistoryError) {
				handleError(releaseHistoryError);
			}
		},
		[handleError, releaseHistoryError]
	);

	// Get current formation
	const { scale: currentScale, loading: currentScaleLoading, error: currentScaleError } = useAppScale(appName);
	React.useEffect(
		() => {
			if (currentScaleError) {
				handleError(currentScaleError);
			}
		},
		[currentScaleError, handleError]
	);

	const [selectedResourceType, setSelectedResourceType] = React.useState<SelectedResourceType>(
		SelectedResourceType.Release
	);
	const emptyScaleRequestDiff = React.useMemo<Diff<string, number>>(() => [], []);
	const [selectedScaleRequestDiff, setSelectedScaleRequestDiff] = React.useState<Diff<string, number>>(
		emptyScaleRequestDiff
	);

	// keep updated scale request diff
	React.useEffect(
		() => {
			if (isDeploying) return;

			if (selectedResourceType === SelectedResourceType.ScaleRequest) {
				const item = items.find((sr) => sr.getName() === selectedItemName);
				const sr = item && item.isScaleRequest ? item.getScaleRequest() : null;
				if (sr) {
					const diff = protoMapDiff((currentScale as ScaleRequest).getNewProcessesMap(), sr.getNewProcessesMap());
					setSelectedScaleRequestDiff(diff.length ? diff : emptyScaleRequestDiff);
					return;
				}
			}
			setSelectedScaleRequestDiff(emptyScaleRequestDiff);
		},
		[currentScale, emptyScaleRequestDiff, isDeploying, items, selectedItemName, selectedResourceType]
	);

	const [nextScale, setNextScale] = React.useState<CreateScaleRequest | null>(null);
	const [nextReleaseName, setNextReleaseName] = React.useState('');
	const submitHandler = (e: React.SyntheticEvent) => {
		e.preventDefault();

		if (selectedItemName === '') {
			return;
		}

		if (selectedResourceType === SelectedResourceType.ScaleRequest) {
			// It's a scale request we're deploying
			const item = items.find((sr) => sr.getName() === selectedItemName);
			const sr = item && item.isScaleRequest ? item.getScaleRequest() : null;
			const nextScale = new CreateScaleRequest();
			if (!sr) {
				return;
			}
			nextScale.setParent(sr.getParent());
			protoMapReplace(nextScale.getProcessesMap(), sr.getNewProcessesMap());
			protoMapReplace(nextScale.getTagsMap(), sr.getNewTagsMap());
			setNextScale(nextScale);
			if (selectedItemName.startsWith(currentReleaseName)) {
				// We're scaling the current release
				setNextReleaseName(currentReleaseName);
			} else {
				// We're deploying and scaling a release
				setNextReleaseName(sr.getParent());
			}
			setIsDeploying(true);
		} else {
			// It's a release we're deploying
			setNextReleaseName(selectedItemName);
			setNextScale(null);
			setIsDeploying(true);
		}
	};

	const handleDeployCancel = () => {
		setIsDeploying(false);
		setNextReleaseName('');
		setNextScale(null);
	};

	const handleDeployComplete = () => {
		setIsDeploying(false);
		setNextReleaseName('');
		setNextScale(null);
	};

	const paddingTopRef = React.useRef<HTMLElement>();
	const paddingBottomRef = React.useRef<HTMLElement>();

	const [startIndex, setStartIndex] = React.useState(0);
	const [length, setLength] = React.useState(0);
	const windowedListState = React.useMemo(() => new WindowedListState(), []);
	React.useEffect(
		() => {
			return windowedListState.onChange((state: WindowedListState) => {
				// console.log('windowedListState.onChange', state);
				const paddingTopNode = paddingTopRef.current;
				if (paddingTopNode) {
					paddingTopNode.style.height = state.paddingTop + 'px';
				}
				const paddingBottomNode = paddingBottomRef.current;
				if (paddingBottomNode) {
					paddingBottomNode.style.height = state.paddingBottom + 'px';
				}

				setStartIndex(state.visibleIndexTop);
				setLength(state.visibleLength);
			});
		},
		[windowedListState]
	);

	React.useLayoutEffect(
		() => {
			windowedListState.viewportHeight = 400; // TODO(jvatic): actually calculate this and update on resize
			windowedListState.length = items.length;
			windowedListState.defaultHeight = 150;
			windowedListState.calculateVisibleIndices();
		},
		[items.length, windowedListState]
	);

	if (releaseHistoryLoading || currentScaleLoading || appLoading) {
		return <Loading />;
	}

	return (
		<>
			{isDeploying ? (
				<RightOverlay onClose={handleDeployCancel}>
					{selectedResourceType === SelectedResourceType.ScaleRequest &&
					nextReleaseName &&
					nextReleaseName === currentReleaseName &&
					nextScale ? (
						<CreateScaleRequestComponent
							appName={appName}
							nextScale={nextScale}
							onCancel={handleDeployCancel}
							onCreate={handleDeployComplete}
							handleError={handleError}
						/>
					) : (
						<CreateDeployment
							appName={appName}
							releaseName={nextReleaseName}
							newScale={nextScale || undefined}
							onCancel={handleDeployCancel}
							onCreate={handleDeployComplete}
							handleError={handleError}
						/>
					)}
				</RightOverlay>
			) : null}

			<form onSubmit={submitHandler}>
				<Box
					tag="ul"
					flex={false}
					overflow={{ vertical: 'scroll', horizontal: 'auto' }}
					style={{
						position: 'relative',
						height: 400
					}}
				>
					<Box tag="li" ref={paddingTopRef as any} style={{ height: windowedListState.paddingTop }} flex="grow">
						&nbsp;
					</Box>
					<WindowedList state={windowedListState}>
						{(windowedListItemProps) => {
							return mapHistory({
								startIndex,
								length,
								items,
								renderDate: (key, date) => <ReleaseHistoryDateHeader key={key} date={date} tag="li" margin="xsmall" />,
								renderRelease: (key, [r, p], index) => (
									<WindowedListItem key={key} index={index} {...windowedListItemProps}>
										{(ref) => (
											<ReleaseHistoryRelease
												ref={ref}
												tag="li"
												flex="grow"
												margin={{ bottom: 'small' }}
												release={r}
												prevRelease={p}
												selected={selectedItemName === r.getName()}
												isCurrent={currentReleaseName === r.getName()}
												onChange={(isSelected) => {
													if (isSelected) {
														setSelectedItemName(r.getName());
														setSelectedResourceType(SelectedResourceType.Release);
													} else {
														setSelectedItemName(currentReleaseName);
														setSelectedResourceType(SelectedResourceType.Release);
													}
												}}
											/>
										)}
									</WindowedListItem>
								),
								renderScale: (key, s, index) => (
									<WindowedListItem key={key} index={index} {...windowedListItemProps}>
										{(ref) => (
											<ReleaseHistoryScale
												ref={ref}
												tag="li"
												flex="grow"
												margin={{ bottom: 'small' }}
												scaleRequest={s}
												selected={selectedItemName === s.getName()}
												isCurrent={currentScale ? currentScale.getName() === s.getName() : false}
												onChange={(isSelected) => {
													if (isSelected) {
														setSelectedItemName(s.getName());
														setSelectedResourceType(SelectedResourceType.ScaleRequest);
													} else {
														setSelectedItemName(currentReleaseName);
														setSelectedResourceType(SelectedResourceType.Release);
													}
												}}
											/>
										)}
									</WindowedListItem>
								)
							});
						}}
					</WindowedList>
					<Box tag="li" ref={paddingBottomRef as any} style={{ height: windowedListState.paddingBottom }} flex="grow">
						&nbsp;
					</Box>
				</Box>

				<StickyBox bottom="0px" background="background" pad="xsmall" width="medium">
					{selectedResourceType === SelectedResourceType.ScaleRequest ? (
						selectedItemName.startsWith(currentReleaseName) ? (
							<Button
								type="submit"
								disabled={(selectedScaleRequestDiff as Diff<string, number>).length === 0}
								primary
								icon={<CheckmarkIcon />}
								label="Scale Release"
							/>
						) : (
							<Button type="submit" primary icon={<CheckmarkIcon />} label="Deploy Release / Scale" />
						)
					) : (
						<Button
							type="submit"
							disabled={selectedItemName === currentReleaseName}
							primary
							icon={<CheckmarkIcon />}
							label="Deploy Release"
						/>
					)}
				</StickyBox>
			</form>
		</>
	);
}
export default React.memo(ReleaseHistory, function areEqual(prevProps: Props, nextProps: Props) {
	return prevProps.appName !== nextProps.appName;
});

ifDev(() => ((ReleaseHistory as any).whyDidYouRender = true));
