import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePomodoroTimer,
  formatTime,
  calculateProgress,
  type PomodoroPhase,
} from '../use-pomodoro-timer';

describe('usePomodoroTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('初期状態', () => {
    it('idle状態で初期化される', () => {
      const { result } = renderHook(() => usePomodoroTimer(25, 5));

      expect(result.current.state.phase).toBe('idle');
      expect(result.current.state.isRunning).toBe(false);
      expect(result.current.state.remainingSeconds).toBe(25 * 60);
      expect(result.current.state.inputDuration).toBe(25);
      expect(result.current.state.outputDuration).toBe(5);
    });

    it('カスタム時間で初期化できる', () => {
      const { result } = renderHook(() => usePomodoroTimer(20, 10));

      expect(result.current.state.remainingSeconds).toBe(20 * 60);
      expect(result.current.state.inputDuration).toBe(20);
      expect(result.current.state.outputDuration).toBe(10);
    });
  });

  describe('タイマー開始', () => {
    it('start()でinputフェーズに移行する', () => {
      const { result } = renderHook(() => usePomodoroTimer(25, 5));

      act(() => {
        result.current.start();
      });

      expect(result.current.state.phase).toBe('input');
      expect(result.current.state.isRunning).toBe(true);
    });

    it('start()でonPhaseChangeが呼ばれる', () => {
      const onPhaseChange = vi.fn();
      const { result } = renderHook(() => usePomodoroTimer(25, 5, onPhaseChange));

      act(() => {
        result.current.start();
      });

      expect(onPhaseChange).toHaveBeenCalledWith('input');
    });
  });

  describe('タイマーのカウントダウン', () => {
    it('1秒ごとにremainingSecondsが減少する', () => {
      const { result } = renderHook(() => usePomodoroTimer(1, 1)); // 1分

      act(() => {
        result.current.start();
      });

      expect(result.current.state.remainingSeconds).toBe(60);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.state.remainingSeconds).toBe(59);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.state.remainingSeconds).toBe(54);
    });
  });

  describe('フェーズ遷移', () => {
    it('inputフェーズ終了後にoutputフェーズに移行する', () => {
      const onPhaseChange = vi.fn();
      const { result } = renderHook(() => usePomodoroTimer(1, 1, onPhaseChange)); // 各1分

      act(() => {
        result.current.start();
      });

      // input 1分経過
      act(() => {
        vi.advanceTimersByTime(60 * 1000);
      });

      expect(result.current.state.phase).toBe('output');
      expect(result.current.state.remainingSeconds).toBe(60); // output 1分
      expect(onPhaseChange).toHaveBeenCalledWith('output');
    });

    it('outputフェーズ終了後にcompletedフェーズに移行する', () => {
      const onPhaseChange = vi.fn();
      const { result } = renderHook(() => usePomodoroTimer(1, 1, onPhaseChange));

      act(() => {
        result.current.start();
      });

      // input + output 2分経過
      act(() => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      });

      expect(result.current.state.phase).toBe('completed');
      expect(result.current.state.isRunning).toBe(false);
      expect(onPhaseChange).toHaveBeenCalledWith('completed');
    });
  });

  describe('一時停止と再開', () => {
    it('pause()でタイマーが停止する', () => {
      const { result } = renderHook(() => usePomodoroTimer(25, 5));

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      const remainingBeforePause = result.current.state.remainingSeconds;

      act(() => {
        result.current.pause();
      });

      expect(result.current.state.isRunning).toBe(false);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // 一時停止中は時間が進まない
      expect(result.current.state.remainingSeconds).toBe(remainingBeforePause);
    });

    it('resume()でタイマーが再開する', () => {
      const { result } = renderHook(() => usePomodoroTimer(25, 5));

      act(() => {
        result.current.start();
      });

      act(() => {
        result.current.pause();
      });

      const remainingBeforeResume = result.current.state.remainingSeconds;

      act(() => {
        result.current.resume();
      });

      expect(result.current.state.isRunning).toBe(true);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.state.remainingSeconds).toBe(remainingBeforeResume - 5);
    });
  });

  describe('リセット', () => {
    it('reset()で初期状態に戻る', () => {
      const { result } = renderHook(() => usePomodoroTimer(25, 5));

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(30000);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.state.phase).toBe('idle');
      expect(result.current.state.isRunning).toBe(false);
      expect(result.current.state.remainingSeconds).toBe(25 * 60);
    });
  });

  describe('outputフェーズへのスキップ', () => {
    it('skipToOutput()でoutputフェーズに移行する', () => {
      const onPhaseChange = vi.fn();
      const { result } = renderHook(() => usePomodoroTimer(25, 5, onPhaseChange));

      act(() => {
        result.current.start();
      });

      act(() => {
        result.current.skipToOutput();
      });

      expect(result.current.state.phase).toBe('output');
      expect(result.current.state.remainingSeconds).toBe(5 * 60);
      expect(onPhaseChange).toHaveBeenCalledWith('output');
    });

    it('idle状態ではskipToOutputが無効', () => {
      const { result } = renderHook(() => usePomodoroTimer(25, 5));

      act(() => {
        result.current.skipToOutput();
      });

      expect(result.current.state.phase).toBe('idle');
    });
  });
});

describe('formatTime', () => {
  it('秒をMM:SS形式にフォーマットする', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(59)).toBe('00:59');
    expect(formatTime(60)).toBe('01:00');
    expect(formatTime(125)).toBe('02:05');
    expect(formatTime(1500)).toBe('25:00');
  });
});

describe('calculateProgress', () => {
  it('進捗率を計算する', () => {
    expect(calculateProgress(100, 100)).toBe(0);
    expect(calculateProgress(50, 100)).toBe(50);
    expect(calculateProgress(0, 100)).toBe(100);
    expect(calculateProgress(75, 100)).toBe(25);
  });

  it('totalが0の場合は0を返す', () => {
    expect(calculateProgress(50, 0)).toBe(0);
  });
});
