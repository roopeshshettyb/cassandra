export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | AudioBufferSourceNode | null = null;
  private dataArray: number[] = [];
  private isInitialized = false;

  async initWithMicrophone(stream: MediaStream): Promise<void> {
    await this.init();
    if (this.audioContext && this.analyser) {
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
    }
  }

  async initWithAudioElement(audioElement: HTMLAudioElement): Promise<void> {
    await this.init();
    if (this.audioContext && this.analyser) {
      const source = this.audioContext.createMediaElementSource(audioElement);
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.dataArray = new Array(this.analyser.frequencyBinCount).fill(0);
    this.isInitialized = true;
  }

  getData(): { frequencyData: number[]; volume: number } {
    if (!this.analyser) {
      return { frequencyData: new Array(128).fill(0), volume: 0 };
    }

    const tempArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(tempArray);
    
    // Copy to regular number array to avoid TypeScript issues
    for (let i = 0; i < tempArray.length; i++) {
      this.dataArray[i] = tempArray[i];
    }
    
    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const volume = sum / this.dataArray.length / 255;

    return {
      frequencyData: [...this.dataArray],
      volume,
    };
  }

  getVolume(): number {
    return this.getData().volume;
  }

  disconnect(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
  }

  destroy(): void {
    this.disconnect();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.isInitialized = false;
  }
}
