import * as React from 'react';
import { debounce } from 'lodash';

// TODO: Finish refactoring to use WindowedListState (there's a bunch of old code in here that's not doing anything)

import WindowedListState from './WindowedListState';

function findScrollParent(node: HTMLElement | null): HTMLElement | Window {
	while (node) {
		switch (window.getComputedStyle(node).overflowY) {
			case 'auto':
				return node;
			case 'scroll':
				return node;
			default:
				node = node.parentElement;
		}
	}
	return window;
}

type ForceUpdateFunction = (callback: () => void) => void;

export interface ChildrenProps {
	onItemRender: (index: number, node: HTMLElement | null, foceUpdate: ForceUpdateFunction) => void;
	shouldItemRender: (index: number) => boolean;
	getItemDimensions: (index: number) => ItemDimensions | null;
}

export interface Props {
	state: WindowedListState;
	children: (props: ChildrenProps) => React.ReactNode;
}

interface ItemDimensions {
	top: number;
	height: number;
}

export default function WindowedList({ state, children }: Props) {
	const itemDimensions = React.useMemo(() => new Map<number, ItemDimensions | null>(), []);
	const itemRefs = React.useMemo(() => new Map<number, HTMLElement>(), []);
	const itemRenderFns = React.useMemo(() => new Map<number, ForceUpdateFunction>(), []);
	const scrollParentRef = React.useMemo<{ current: HTMLElement | Window | null }>(() => ({ current: null }), []);

	const willUnmountFns = React.useMemo<Array<() => void>>(() => [], []);
	React.useEffect(
		() => {
			return () => {
				willUnmountFns.forEach((fn) => fn());
			};
		},
		[willUnmountFns]
	);

	const calcItemDimensions = React.useCallback((node: HTMLElement): ItemDimensions | null => {
		const rect = node.getClientRects()[0];
		if (!rect) return null;
		const style = window.getComputedStyle(node);
		const margin =
			parseFloat(style.getPropertyValue('margin-top')) + parseFloat(style.getPropertyValue('margin-bottom'));
		const dimensions = { top: rect.top, height: rect.height + margin };
		return dimensions;
	}, []);

	const getScrollTop = React.useCallback(
		() => {
			if (scrollParentRef.current === null) {
				return 0;
			}
			let scrollTop = 0;
			if (scrollParentRef.current === window) {
				scrollTop = window.scrollY;
			} else {
				scrollTop = (scrollParentRef.current as HTMLElement).scrollTop;
			}
			return scrollTop;
		},
		[scrollParentRef]
	);

	const handleScroll = React.useCallback(
		() => {
			// const prevVisibleIndexTop = state.visibleIndexTop;
			// const prevVisibleLength = state.visibleLength;

			const scrollTop = getScrollTop();
			state.updateScrollPosition(scrollTop);
			state.calculateVisibleIndices(); // workaround bug with updateScrollPosition

// 			const visibleIndexTop = state.visibleIndexTop;
// 			const visibleLength = state.visibleLength;

// 			console.log({ scrollTop, prevVisibleIndexTop, visibleIndexTop, prevVisibleLength, visibleLength });
		},
		[getScrollTop, state]
	);

	const handleResize = React.useCallback(() => {
		// TODO(jvatic): this will need to trigger a reset of item dimensions
	}, []);

	const onItemRender = React.useCallback(
		(index: number, node: HTMLElement | null, forceUpdate: ForceUpdateFunction) => {
			if (!node) {
				return;
			}

			// keep track of node for each index so that we can recalculate item
			// heights when the viewport changes size.
			itemRefs.set(index, node);

			// store render fns for each index so that we can take items in and out
			// of the DOM as they become visible/invisible.
			itemRenderFns.set(index, forceUpdate);

			// calculate item dimensions
			const dimensions = calcItemDimensions(node);
			itemDimensions.set(index, dimensions);
			if (dimensions) {
				state.updateHeightAtIndex(index, dimensions.height);
			}

			if (scrollParentRef.current === null) {
				const scrollParentNode = findScrollParent(node.parentElement);
				scrollParentRef.current = scrollParentNode;
				scrollParentNode.addEventListener('scroll', handleScroll, false);
				willUnmountFns.push(() => {
					scrollParentNode.removeEventListener('scroll', handleScroll, false);
				});
				scrollParentNode.addEventListener('resize', handleResize, false);
				willUnmountFns.push(() => {
					scrollParentNode.removeEventListener('resize', handleResize, false);
				});
				// const resizeNode: HTMLElement = scrollParentNode === window ? document.body : (scrollParentNode as HTMLElement);
				// mutationObserver.observe(resizeNode, { attributes: true, childList: true, subtree: true });
			}
		},
		[
			calcItemDimensions,
			handleResize,
			handleScroll,
			itemDimensions,
			itemRefs,
			itemRenderFns,
			scrollParentRef,
			state,
			willUnmountFns
		]
	);

	const shouldItemRender = React.useCallback(
		(index: number): boolean => {
			// item should render if it's in the visible index range
			return state.visibleIndexTop <= index && state.visibleIndexTop + state.visibleLength > index;
		},
		[state] // eslint-disable-line react-hooks/exhaustive-deps
	);

	const getItemDimensions = React.useCallback(
		(index: number): ItemDimensions | null => {
			return itemDimensions.get(index) || null;
		},
		[itemDimensions]
	);

	return <>{children({ onItemRender, shouldItemRender, getItemDimensions })}</>;
}

export interface ItemProps extends ChildrenProps {
	index: number;
	children: (ref: React.MutableRefObject<HTMLElement | null>) => React.ReactNode;
}

export const WindowedListItem = ({ children, index, onItemRender, shouldItemRender, getItemDimensions }: ItemProps) => {
	const [_forceUpdate, _setForceUpdate] = React.useState(false);
	const forceUpdateCallbackRef = React.useMemo<{ current: (() => void) | null }>(() => ({ current: null }), []);
	const forceUpdate = React.useCallback(
		(callback: () => void) => {
			forceUpdateCallbackRef.current = callback;
			_setForceUpdate(!_forceUpdate);
		},
		[_forceUpdate, forceUpdateCallbackRef]
	);
	const ref = React.useMemo<{ current: null | HTMLElement }>(() => ({ current: null }), []);
	React.useLayoutEffect(
		() => {
			onItemRender(index, ref.current, forceUpdate);
			if (forceUpdateCallbackRef.current) {
				let callback = forceUpdateCallbackRef.current;
				forceUpdateCallbackRef.current = null;
				callback();
			}
		},
		[forceUpdate, forceUpdateCallbackRef, getItemDimensions, index, onItemRender, ref]
	);
	// if (!shouldItemRender(index)) {
	// 	ref.current = null;
	// 	return null;
	// }
	return <>{children(ref)}</>;
};
