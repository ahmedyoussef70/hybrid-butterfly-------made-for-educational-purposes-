import createHistory from 'history/createBrowserHistory'
export default {
  didMounts: [],
  willUnmounts: [],
  appInstance: null,
  history: createHistory()
}
