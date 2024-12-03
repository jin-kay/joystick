// 导入 ble_hid_combo 模块
var int = require("ble_hid_combo");

// 初始化蓝牙 HID 服务，设置组合模式
NRF.setServices(undefined, { hid: int.report });

// 设置手势检测的速度阈值和手势持续时间
var GESTURE_DETECTION_SPEED = 15;
var GESTURE_DURATION = 20;
var USE_BLE = 1;
var on = true;
var complexMode = false; // 复杂模式标志
var cursorMode = false; // 光标模式标志
var oldX = 0, oldY = 0; // 上一次加速度值
var deltaX = 0; // X方向变化量，用于手势检测

// 定义基础灵敏度、最小速度和最大速度
const baseSensitivity = 3000;
const minSpeed = 0.01;
const maxSpeed = 35;
const sensitivity = 1000;

let detect = 0; // 手势检测计数器

// 改进的按键发送函数，模拟按下和释放事件
function sendKeyPress(keyCode) {
  try {
    int.tapKey(keyCode); // 使用 ble_hid_combo 的 tapKey 方法
    setTimeout(() => int.tapKey(0), 50); // 延迟释放按键
  } catch (error) {
    console.log("Error sending key press:", error);
  }
}

// 鼠标移动事件处理函数
function moveMouse(dx, dy) {
  try {
    int.moveMouse(dx, dy); // 使用 ble_hid_combo 的 moveMouse 方法
  } catch (error) {
    console.log("Error moving mouse:", error);
  }
}

// 复位模式和状态
function resetModes() {
  complexMode = false;
  cursorMode = false;
  oldX = 0;
  oldY = 0;
}

// 处理加速度计事件的函数，核心逻辑
function onAccel(a) {
  // 如果按钮被按下，处理模式切换逻辑
  if (digitalRead(BTN) === 1) {
    LED3.write(true);

    // 判断模式切换
    if (a.acc.x < sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
      complexMode = true; // 向左倾斜进入复杂模式
      cursorMode = false; // 确保退出光标模式
      console.log("Switched to Complex Mode");
    } else if (a.acc.x > sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
      cursorMode = true; // 向右倾斜进入光标模式
      complexMode = false; // 确保退出复杂模式
      console.log("Switched to Cursor Mode");
    } else if (a.acc.y < sensitivity && Math.abs(a.acc.y) > Math.abs(a.acc.x)) {
      resetModes(); // 向下倾斜退出复杂模式和光标模式
      console.log("Switched to Normal Mode");
    }
    return; // 模式切换完成，退出
  } else {
    LED3.write(false);
  }

  // 光标模式逻辑
  if (cursorMode) {
    if (Math.abs(a.acc.x) > sensitivity && Math.abs(a.acc.x) > Math.abs(a.acc.y)) {
      sendKeyPress(a.acc.x > 0 ? int.KEY.LEFT : int.KEY.RIGHT); // 左右方向键（保持正确的物理方向）
    } else if (Math.abs(a.acc.y) > sensitivity && Math.abs(a.acc.y) > Math.abs(a.acc.x)) {
      sendKeyPress(a.acc.y < 0 ? int.KEY.UP : int.KEY.DOWN); // 上下方向键（保持正确的物理方向）
    }
    return; // 光标模式下不执行鼠标移动
  }

  // 初始化鼠标移动量
  let x = 0, y = 0;

  // 检查是否接近直立位置（普通模式和复杂模式共用）
  if (Math.abs(a.acc.x) < sensitivity && Math.abs(a.acc.y) < sensitivity) {
    x = 0;
    y = 0;
  } else {
    // 计算倾斜程度并动态调整速度
    const tiltX = Math.abs(a.acc.x);
    const tiltY = Math.abs(a.acc.y);

    const dynamicSpeedX = tiltX < baseSensitivity
      ? minSpeed + (tiltX / baseSensitivity) * (tiltX / baseSensitivity) * (maxSpeed - minSpeed)
      : maxSpeed;

    const dynamicSpeedY = tiltY < baseSensitivity
      ? minSpeed + (tiltY / baseSensitivity) * (tiltY / baseSensitivity) * (maxSpeed - minSpeed)
      : maxSpeed;

    // 修正鼠标移动方向，使得物理方向与控制相符
    x = a.acc.x > 0 ? -dynamicSpeedX : dynamicSpeedX; // 反转X方向，使物理方向与鼠标移动方向一致
    y = a.acc.y < 0 ? -dynamicSpeedY : dynamicSpeedY; // 保持Y方向一致
  }

  // 手势检测逻辑
  deltaX = Math.abs(x - oldX);
  const deltaY = Math.abs(y - oldY);
  oldX = x;
  oldY = y;

  if (complexMode && (deltaX > GESTURE_DETECTION_SPEED || deltaY > GESTURE_DETECTION_SPEED)) {
    detect = GESTURE_DURATION; // 启用手势检测
    LED3.write(true);
  }

  if (detect > 0) {
    detect--;
    if (detect == 0) LED3.write(false);
  }

  // 在普通模式和复杂模式下发送鼠标移动数据
  if (on && USE_BLE && detect == 0) {
    if (x !== 0 || y !== 0) moveMouse(x, y);
  }
}

// 启用加速度计并监听
Puck.accelOn(26);
Puck.on('accel', onAccel);

// 启用蓝牙广告
if (USE_BLE) {
  NRF.setAdvertising({}, { name: "Puck.js Joystick" });
}

console.log('BLEJoystick ready with Enhanced Mode');
