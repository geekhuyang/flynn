export const testRef = {
	enableDebug: false
};

function debug(cb: () => void) {
	if (testRef.enableDebug) {
		cb();
	}
}

export default class WindowedListState {
	public viewportHeight: number; // viewport height in px
	public length: number; // size of list
	public defaultHeight: number; // estimated height of list item if we don't have the actual height

	public visibleIndexTop: number; // first index to be rendered
	public visibleLength: number; // number of items to be rendered
	public paddingTop: number; // estimated height of all items not rendered above the first visible index
	public paddingBottom: number; // estimated height of all items not rendered below the last visible index

	private scrollTop: number; // current scroll offset
	private heights: Map<number, number>; // index => height

	constructor() {
		this.viewportHeight = 0;
		this.length = 0;
		this.defaultHeight = 0;

		this.visibleIndexTop = 0;
		this.visibleLength = 0;
		this.paddingTop = 0;
		this.paddingBottom = 0;

		this.scrollTop = 0;
		this.heights = new Map<number, number>();
	}

	public calculateVisibleIndices(): void {
		if (this.scrollTop === 0) {
			this.visibleIndexTop = 0;
		} else {
			let visibleIndexTop = 0;
			let paddingTop = 0;
			for (let i = 0; i < this.length; i++) {
				const height = this.getItemHeight(i);
				if (paddingTop + height < this.scrollTop) {
					paddingTop = paddingTop + height;
					visibleIndexTop++;
				} else {
					break;
				}
			}
			this.visibleIndexTop = visibleIndexTop;
			this.paddingTop = paddingTop;
		}

		let visibleLength = 0;
		let visibleHeight = 0;
		for (let i = this.visibleIndexTop; i < this.length; i++) {
			if (visibleHeight < this.viewportHeight) {
				visibleHeight = visibleHeight + this.getItemHeight(i);
				visibleLength++;
			} else {
				break;
			}
		}
		this.visibleLength = visibleLength;

		let paddingBottom = 0;
		for (let i = this.visibleIndexTop + this.visibleLength; i < this.length; i++) {
			paddingBottom = paddingBottom + this.getItemHeight(i);
		}
		this.paddingBottom = paddingBottom;
	}

	// sets scrollTop and re-calculates vidibleIndexTop/visibleLength and padding
	public updateScrollPosition(scrollTop: number): void {
		const prevScrollTop = this.scrollTop;
		const prevVisibleIndexTop = this.visibleIndexTop;
		const prevVisibleLength = this.visibleLength;
		const scrollTopDelta = scrollTop - prevScrollTop;
		this.scrollTop = scrollTop;

		if (scrollTopDelta === 0) {
			// no change
			return;
		}

		if (scrollTopDelta < 0) {
			// scrolled up
			let visibleIndexTop = this.visibleIndexTop;
			let paddingTop = this.paddingTop;
			for (let i = visibleIndexTop; i >= 0; i--) {
				const height = this.getItemHeight(i);
				if (paddingTop > scrollTop) {
					paddingTop = paddingTop - height;
					visibleIndexTop--;
				} else {
					break;
				}
			}
			this.visibleIndexTop = visibleIndexTop;
			this.paddingTop = paddingTop;
		} else {
			// scrolled down
			let visibleIndexTop = this.visibleIndexTop;
			let paddingTop = this.paddingTop;
			for (let i = visibleIndexTop; i < this.length; i++) {
				const height = this.getItemHeight(i);
				if (paddingTop + height < scrollTopDelta) {
					paddingTop = paddingTop + height;
					visibleIndexTop++;
				} else {
					break;
				}
			}
			this.visibleIndexTop = visibleIndexTop;
			this.paddingTop = paddingTop;
		}

		let visibleLength = 0;
		let visibleHeight = 0;
		for (let i = this.visibleIndexTop; i < this.length; i++) {
			if (visibleHeight < this.viewportHeight) {
				visibleHeight = visibleHeight + this.getItemHeight(i);
				visibleLength++;
			} else {
				break;
			}
		}
		this.visibleLength = visibleLength;

		if (prevVisibleIndexTop === this.visibleIndexTop) {
			// no change
			return;
		}

		const prevVisibleIndexBottom = prevVisibleIndexTop + prevVisibleLength - 1;
		const visibleIndexBottom = this.visibleIndexTop + this.visibleLength - 1;
		if (this.visibleIndexTop < prevVisibleIndexTop) {
			// scrolled up
			const heightDelta = this.getItemRangeHeight(visibleIndexBottom + 1, prevVisibleIndexBottom);
			this.paddingBottom = this.paddingBottom + heightDelta;
		} else {
			// scrolled down
			const heightDelta = this.getItemRangeHeight(prevVisibleIndexBottom + 1, visibleIndexBottom);
			this.paddingBottom = this.paddingBottom - heightDelta;
		}
	}

	// sets item height and re-calculates vidibleIndexTop/visibleLength and padding
	public updateHeightAtIndex(index: number, height: number): void {
		this.heights.set(index, height);

		// TODO: calculate based on delta
		this.calculateVisibleIndices();
	}

	private getItemHeight(index: number): number {
		return this.heights.get(index) || this.defaultHeight;
	}

	private getItemRangeHeight(startIndex: number, endIndex: number): number {
		let sum = 0;
		for (let i = startIndex; i <= endIndex; i++) {
			sum = sum + this.getItemHeight(i);
		}
		return sum;
	}
}

// TODO: write tests to make sure WindowedListState works as expected
// TODO: re-write WindowedList to use WindowedListState
// TODO: implement sticky items (items that are always rendered)
