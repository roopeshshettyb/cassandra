1. api.js should be used for api calls. This is a very powerful method. It handles loading, notifications everything. So always pass the loaders to allow this to handle loading. For notifications let the backend return message so apijs would only do the alert as well if needed, keeps your react component code minimal. It also uses setData, which is also verify powerful where u can directly send the set state variable and it'll set it
2. Common toast should be used for alerts
3. MapComponent should be used to render multiple items
4. This is an SPA, and the components should be written in such a way and the back button at top right should work
5. All designs should be responsive.
6. Buttons and action visibility should be as per permissions
7. All styling should be used from theme ONLY AND ONLY.
8. Run build and ensure no issues.
9. Only one useeffect per page and with dependencies as [], if you're doing otherwise ask me
10. Only use loading , setLoading for loading states dont create any new loading states
