# Lists

- Searchable or filterable lists use `useListControls` with `<ListControls />`, as in `ManageHotels.js`.
- Render items with `MapComponent` (`<MapComponent Component={RoomRow} data={rooms} isLoading={loading} />`), not a bare `.map` in JSX. Each item arrives as the `data` prop, and the empty state comes built in.
