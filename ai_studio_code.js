// JavaScript 逻辑代码
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const colorOptions = document.querySelectorAll('.color-option');
    const brushSizeSlider = document.getElementById('brush-size-slider');
    const playMusicBtn = document.getElementById('play-music-btn');
    const clearCanvasBtn = document.getElementById('clear-canvas-btn');

    // 设置画布大小
    canvas.width = 800;
    canvas.height = 400;

    let drawing = false;
    let brushColor = 'red';
    let brushSize = 10;
    let drawnPoints = [];
    let audioContext;

    // 延迟初始化AudioContext，直到用户首次交互
    const getAudioContext = () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioContext;
    };

    function updateBrushSize() {
        brushSize = brushSizeSlider.value;
    }

    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            document.querySelector('.color-option.active').classList.remove('active');
            option.classList.add('active');
            brushColor = option.dataset.color;
        });
    });

    brushSizeSlider.addEventListener('input', updateBrushSize);

    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }

    function startDrawing(e) {
        drawing = true;
        getAudioContext(); // 在用户首次交互时创建音频上下文
        draw(e);
    }

    function stopDrawing() {
        drawing = false;
        ctx.beginPath(); // 停止绘画后，开始新的路径
    }

    function draw(e) {
        if (!drawing) return;
        const pos = getMousePos(canvas, e);
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.strokeStyle = brushColor;
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        drawnPoints.push({ x: pos.x, y: pos.y, color: brushColor, size: parseFloat(brushSize) });
    }

    // 添加事件监听器
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseleave', stopDrawing); // 当鼠标离开画布时停止绘画

    clearCanvasBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawnPoints = [];
    });

    playMusicBtn.addEventListener('click', () => {
        const actx = getAudioContext();
        if (!actx) {
            alert("抱歉，您的浏览器不支持Web Audio API。");
            return;
        }
        // 如果音频上下文被挂起（通常在自动播放策略下），则恢复它
        if (actx.state === 'suspended') {
            actx.resume();
        }

        const gainNode = actx.createGain();
        gainNode.connect(actx.destination);
        const totalDuration = 4; // 音乐总时长（秒）

        // 按X轴位置排序，确保音乐从左到右播放
        const sortedPoints = [...drawnPoints].sort((a, b) => a.x - b.x);

        sortedPoints.forEach(point => {
            // Y轴映射到MIDI音高 (范围从36到83，大约是C2到B5)
            const pitch = Math.floor((1 - point.y / canvas.height) * 48) + 36;
            // X轴映射到播放时间
            const time = (point.x / canvas.width) * totalDuration;
            
            let octaveOffset = 0;
            let waveType = 'sine'; // 默认音色 (红色)

            switch (point.color) {
                case 'limegreen': octaveOffset = 12; waveType = 'triangle'; break; // 绿色: 高八度, 三角波
                case 'blue': octaveOffset = -12; waveType = 'sawtooth'; break; // 蓝色: 低八度, 锯齿波
                case 'yellow': waveType = 'square'; break; // 黄色: 中音区, 方波
            }
            
            const volume = point.size / 50; // 画笔大小影响音量
            const noteDuration = 0.1 + (point.size / 50) * 0.2; // 画笔大小影响持续时间
            const playTime = actx.currentTime + time;

            if (point.color === 'black') { // 黑色代表打击乐噪音
                const noiseSource = actx.createBufferSource();
                const bufferSize = actx.sampleRate * noteDuration;
                const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1; // 生成白噪音
                }
                noiseSource.buffer = buffer;
                const noiseGain = actx.createGain();
                noiseGain.gain.setValueAtTime(volume, playTime);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, playTime + noteDuration);
                noiseSource.connect(noiseGain);
                noiseGain.connect(gainNode);
                noiseSource.start(playTime);
            } else { // 其他颜色代表音调
                const oscillator = actx.createOscillator();
                const noteGain = actx.createGain();
                oscillator.type = waveType;
                // 根据MIDI音高计算频率
                const frequency = 440 * Math.pow(2, ((pitch + octaveOffset) - 69) / 12);
                oscillator.frequency.setValueAtTime(frequency, playTime);
                noteGain.gain.setValueAtTime(volume, playTime);
                noteGain.gain.exponentialRampToValueAtTime(0.001, playTime + noteDuration); // 音符淡出效果
                oscillator.connect(noteGain);
                noteGain.connect(gainNode);
                oscillator.start(playTime);
                oscillator.stop(playTime + noteDuration);
            }
        });
    });

    updateBrushSize(); // 页面加载时初始化画笔大小
});