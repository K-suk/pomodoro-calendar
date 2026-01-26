import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useBlurtingSession,
  countWords,
  countCharacters,
  calculateWordsPerMinute,
} from '../use-blurting-session';

describe('useBlurtingSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('初期状態', () => {
    it('非アクティブ状態で初期化される', () => {
      const { result } = renderHook(() => useBlurtingSession());

      expect(result.current.state.isActive).toBe(false);
      expect(result.current.state.blurtingText).toBe('');
      expect(result.current.state.startedAt).toBeNull();
      expect(result.current.state.endedAt).toBeNull();
    });
  });

  describe('セッション開始', () => {
    it('startSession()でアクティブになる', () => {
      const { result } = renderHook(() => useBlurtingSession());

      act(() => {
        result.current.startSession();
      });

      expect(result.current.state.isActive).toBe(true);
      expect(result.current.state.startedAt).toBeInstanceOf(Date);
      expect(result.current.state.endedAt).toBeNull();
    });

    it('startSession()でテキストがリセットされる', () => {
      const { result } = renderHook(() => useBlurtingSession());

      act(() => {
        result.current.startSession();
        result.current.updateText('some text');
      });

      act(() => {
        result.current.startSession();
      });

      expect(result.current.state.blurtingText).toBe('');
    });
  });

  describe('テキスト入力', () => {
    it('updateText()でテキストが更新される', () => {
      const { result } = renderHook(() => useBlurtingSession());

      act(() => {
        result.current.startSession();
      });

      act(() => {
        result.current.updateText('学習した内容を思い出して書く');
      });

      expect(result.current.state.blurtingText).toBe('学習した内容を思い出して書く');
    });

    it('複数回の更新が可能', () => {
      const { result } = renderHook(() => useBlurtingSession());

      act(() => {
        result.current.startSession();
      });

      act(() => {
        result.current.updateText('最初の文');
      });

      act(() => {
        result.current.updateText('最初の文。次の文。');
      });

      expect(result.current.state.blurtingText).toBe('最初の文。次の文。');
    });
  });

  describe('セッション終了', () => {
    it('endSession()でセッションが終了する', () => {
      const { result } = renderHook(() => useBlurtingSession());

      act(() => {
        result.current.startSession();
      });

      act(() => {
        result.current.endSession();
      });

      expect(result.current.state.isActive).toBe(false);
      expect(result.current.state.endedAt).toBeInstanceOf(Date);
    });

    it('終了後もテキストが保持される', () => {
      const { result } = renderHook(() => useBlurtingSession());

      act(() => {
        result.current.startSession();
        result.current.updateText('保持されるべきテキスト');
        result.current.endSession();
      });

      expect(result.current.state.blurtingText).toBe('保持されるべきテキスト');
    });
  });

  describe('セッション時間計測', () => {
    it('getSessionDuration()でセッション時間を取得できる', () => {
      const { result } = renderHook(() => useBlurtingSession());

      act(() => {
        result.current.startSession();
      });

      act(() => {
        vi.advanceTimersByTime(30000); // 30秒
      });

      expect(result.current.getSessionDuration()).toBe(30);
    });

    it('終了後も正確な時間を取得できる', () => {
      const { result } = renderHook(() => useBlurtingSession());

      act(() => {
        result.current.startSession();
      });

      act(() => {
        vi.advanceTimersByTime(60000); // 60秒
      });

      act(() => {
        result.current.endSession();
      });

      // 終了後にさらに時間が経過
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // 終了時点の時間が保持される
      expect(result.current.getSessionDuration()).toBe(60);
    });

    it('未開始の場合は0を返す', () => {
      const { result } = renderHook(() => useBlurtingSession());

      expect(result.current.getSessionDuration()).toBe(0);
    });
  });

  describe('セッションリセット', () => {
    it('resetSession()で全てリセットされる', () => {
      const { result } = renderHook(() => useBlurtingSession());

      act(() => {
        result.current.startSession();
        result.current.updateText('テスト');
        result.current.endSession();
      });

      act(() => {
        result.current.resetSession();
      });

      expect(result.current.state.isActive).toBe(false);
      expect(result.current.state.blurtingText).toBe('');
      expect(result.current.state.startedAt).toBeNull();
      expect(result.current.state.endedAt).toBeNull();
    });
  });

  describe('ポモドーロ後のブラーティング統合テスト', () => {
    it('ポモドーロinput終了後にブラーティングセッションを開始できる', () => {
      const { result } = renderHook(() => useBlurtingSession());

      // ポモドーロのinputフェーズが終了したと仮定
      // outputフェーズ（ブラーティング）を開始
      act(() => {
        result.current.startSession();
      });

      expect(result.current.state.isActive).toBe(true);

      // ブラーティング中にテキストを入力
      act(() => {
        result.current.updateText('今日学んだこと：\n1. Reactのフック\n2. TypeScriptの型');
      });

      // ブラーティング時間経過
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000); // 5分
      });

      act(() => {
        result.current.endSession();
      });

      expect(result.current.state.isActive).toBe(false);
      expect(result.current.state.blurtingText).toContain('Reactのフック');
      expect(result.current.getSessionDuration()).toBe(300); // 5分 = 300秒
    });
  });
});

describe('countWords', () => {
  it('英語の単語数をカウントする', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('one two three four five')).toBe(5);
  });

  it('空文字列は0を返す', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });

  it('複数のスペースを正しく処理する', () => {
    expect(countWords('hello   world')).toBe(2);
    expect(countWords('  hello  world  ')).toBe(2);
  });

  it('日本語も単語としてカウントする', () => {
    expect(countWords('今日 学んだ こと')).toBe(3);
  });
});

describe('countCharacters', () => {
  it('文字数をカウントする', () => {
    expect(countCharacters('hello')).toBe(5);
    expect(countCharacters('こんにちは')).toBe(5);
    expect(countCharacters('')).toBe(0);
  });
});

describe('calculateWordsPerMinute', () => {
  it('WPMを計算する', () => {
    expect(calculateWordsPerMinute(60, 60)).toBe(60); // 60語/60秒 = 60WPM
    expect(calculateWordsPerMinute(30, 60)).toBe(30); // 30語/60秒 = 30WPM
    expect(calculateWordsPerMinute(100, 300)).toBe(20); // 100語/300秒 = 20WPM
  });

  it('0秒の場合は0を返す', () => {
    expect(calculateWordsPerMinute(100, 0)).toBe(0);
  });
});
