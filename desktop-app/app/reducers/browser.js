// @flow
import {
  NEW_ADDRESS,
  NEW_ZOOM_LEVEL,
  NEW_SCROLL_POSITION,
  NEW_NAVIGATOR_STATUS,
  NEW_DRAWER_CONTENT,
  NEW_PREVIEWER_CONFIG,
  NEW_ACTIVE_DEVICES,
  NEW_CUSTOM_DEVICE,
  NEW_FILTERS,
  NEW_HOMEPAGE,
  NEW_USER_PREFERENCES,
  DELETE_CUSTOM_DEVICE,
  NEW_DEV_TOOLS_CONFIG,
  NEW_INSPECTOR_STATUS,
} from '../actions/browser';
import type {Action} from './types';
import getAllDevices from '../constants/devices';
import {ipcRenderer, remote} from 'electron';
import settings from 'electron-settings';
import type {Device} from '../constants/devices';
import {
  FLEXIGRID_LAYOUT,
  INDIVIDUAL_LAYOUT,
} from '../constants/previewerLayouts';
import {DEVICE_MANAGER} from '../constants/DrawerContents';
import {
  ACTIVE_DEVICES,
  USER_PREFERENCES,
  CUSTOM_DEVICES,
} from '../constants/settingKeys';
import {isIfStatement} from 'typescript';
import {getHomepage, saveHomepage} from '../utils/navigatorUtils';

export const FILTER_FIELDS = {
  OS: 'OS',
  DEVICE_TYPE: 'DEVICE_TYPE',
};

export const DEVTOOLS_MODES = {
  BOTTOM: 'BOTTOM',
  RIGHT: 'RIGHT',
  UNDOCKER: 'UNDOCKED',
};

type ScrollPositionType = {
  x: number,
  y: number,
};

type NavigatorStatusType = {
  backEnabled: boolean,
  forwardEnabled: boolean,
};

type WindowSizeType = {
  width: number,
  height: number,
};

type DevToolsOpenModeType = DEVTOOLS_MODES.BOTTOM | DEVTOOLS_MODES.RIGHT;

type WindowBoundsType = {
  x: number,
  y: number,
  width: number,
  height: number,
};

type DevToolsConfigType = {
  size: WindowSizeType,
  open: Boolean,
  deviceId: string,
  webViewId: number,
  mode: DevToolsOpenModeType,
  bounds: WindowBoundsType,
};

type DrawerType = {
  open: boolean,
  content: string,
};

type PreviewerType = {
  layout: string,
};

type UserPreferenceType = {
  disableSSLValidation: boolean,
  drawerState: boolean,
};

type FilterFieldType = FILTER_FIELDS.OS | FILTER_FIELDS.DEVICE_TYPE;

type FilterType = {[key: FilterFieldType]: Array<string>};

export type BrowserStateType = {
  devices: Array<Device>,
  homepage: string,
  address: string,
  zoomLevel: number,
  scrollPosition: ScrollPositionType,
  navigatorStatus: NavigatorStatusType,
  drawer: DrawerType,
  previewer: PreviewerType,
  filters: FilterType,
  userPreferences: UserPreferenceType,
  devToolsConfig: DevToolsConfigType,
  isInspecting: boolean,
};

let _activeDevices = null;

function _saveActiveDevices(devices) {
  settings.set(
    ACTIVE_DEVICES,
    devices.map(device => device.name)
  );
  _activeDevices = devices;
}

function _getActiveDevices() {
  if (_activeDevices) {
    return _activeDevices;
  }
  let activeDeviceNames = settings.get(ACTIVE_DEVICES);
  let activeDevices = null;
  if (activeDeviceNames && activeDeviceNames.length) {
    activeDevices = activeDeviceNames
      .map(name => getAllDevices().find(device => device.name === name))
      .filter(Boolean);
  }
  if (!activeDevices || !activeDevices.length) {
    activeDevices = getAllDevices().filter(device => device.added);
    _saveActiveDevices(activeDevices);
  }
  return activeDevices;
}

function _getUserPreferences(): UserPreferenceType {
  return settings.get(USER_PREFERENCES) || {};
}

function _setUserPreferences(userPreferences) {
  settings.set(USER_PREFERENCES, userPreferences);
}

const {width, height} = remote.screen.getPrimaryDisplay().workAreaSize;

export function getBounds(mode, _size) {
  const size = _size || getDefaultDevToolsWindowSize(mode);
  if (mode === DEVTOOLS_MODES.RIGHT) {
    const viewWidth = Math.round(size.width);
    const viewHeight = size.height - 64 - 20;
    return {
      x: width - viewWidth,
      y: height - viewHeight,
      width: viewWidth,
      height: viewHeight,
    };
  }
  const viewHeight = Math.round(size.height) - 20;
  return {
    x: 0,
    y: height - viewHeight,
    width: width,
    height: viewHeight,
  };
}

export function getDefaultDevToolsWindowSize(mode) {
  if (mode === DEVTOOLS_MODES.RIGHT) {
    return {width: width * 0.33, height};
  }
  return {width, height: height * 0.33};
}

export default function browser(
  state: BrowserStateType = {
    devices: _getActiveDevices(),
    homepage: getHomepage(),
    address: getHomepage(),
    zoomLevel: 0.6,
    previousZoomLevel: null,
    scrollPosition: {x: 0, y: 0},
    navigatorStatus: {backEnabled: false, forwardEnabled: false},
    drawer: {
      open:
        _getUserPreferences().drawerState === null
          ? true
          : _getUserPreferences().drawerState,
      content: DEVICE_MANAGER,
    },
    previewer: {layout: FLEXIGRID_LAYOUT},
    filters: {[FILTER_FIELDS.OS]: [], [FILTER_FIELDS.DEVICE_TYPE]: []},
    userPreferences: _getUserPreferences(),
    allDevices: getAllDevices(),
    devToolsConfig: {
      size: getDefaultDevToolsWindowSize(DEVTOOLS_MODES.BOTTOM),
      open: false,
      mode: DEVTOOLS_MODES.BOTTOM,
      bounds: getBounds(DEVTOOLS_MODES.BOTTOM),
    },
    isInspecting: false,
  },
  action: Action
) {
  switch (action.type) {
    case NEW_ADDRESS:
      return {...state, address: action.address};
    case NEW_HOMEPAGE:
      const {homepage} = action;
      saveHomepage(homepage);
      return {...state, homepage};
    case NEW_ZOOM_LEVEL:
      return {...state, zoomLevel: action.zoomLevel};
    case NEW_SCROLL_POSITION:
      return {...state, scrollPosition: action.scrollPosition};
    case NEW_NAVIGATOR_STATUS:
      return {...state, navigatorStatus: action.navigatorStatus};
    case NEW_DRAWER_CONTENT:
      _setUserPreferences({
        ...state.userPreferences,
        drawerState: action.drawer.open,
      });
      return {...state, drawer: action.drawer};
    case NEW_PREVIEWER_CONFIG:
      const updateObject = {previewer: action.previewer};
      if (
        state.previewer.layout !== INDIVIDUAL_LAYOUT &&
        action.previewer.layout === INDIVIDUAL_LAYOUT
      ) {
        updateObject.zoomLevel = 1;
        updateObject.previousZoomLevel = state.zoomLevel;
      }
      if (
        state.previewer.layout === INDIVIDUAL_LAYOUT &&
        action.previewer.layout !== INDIVIDUAL_LAYOUT
      ) {
        updateObject.zoomLevel = state.previousZoomLevel;
        updateObject.previousZoomLevel = null;
      }
      return {...state, ...updateObject};
    case NEW_ACTIVE_DEVICES:
      _saveActiveDevices(action.devices);
      return {...state, devices: action.devices};
    case NEW_CUSTOM_DEVICE:
      const existingDevices = settings.get(CUSTOM_DEVICES) || [];
      settings.set(CUSTOM_DEVICES, [action.device, ...existingDevices]);
      return {...state, allDevices: getAllDevices()};
    case DELETE_CUSTOM_DEVICE:
      const existingCustomDevices = settings.get(CUSTOM_DEVICES) || [];
      settings.set(
        CUSTOM_DEVICES,
        existingCustomDevices.filter(device => device.id != action.device.id)
      );
      return {...state, allDevices: getAllDevices()};
    case NEW_FILTERS:
      return {...state, filters: action.filters};
    case NEW_USER_PREFERENCES:
      settings.set(USER_PREFERENCES, action.userPreferences);
      return {...state, userPreferences: action.userPreferences};
    case NEW_DEV_TOOLS_CONFIG:
      return {...state, devToolsConfig: action.config};
    case NEW_INSPECTOR_STATUS:
      return {...state, isInspecting: action.status};
    default:
      return state;
  }
}
