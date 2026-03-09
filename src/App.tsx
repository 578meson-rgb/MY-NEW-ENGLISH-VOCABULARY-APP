import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  LayoutDashboard, 
  PenTool, 
  Home as HomeIcon, 
  CheckCircle2, 
  ChevronRight, 
  Trophy, 
  Flame, 
  Target,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
  XCircle,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractVocabFromText } from './services/geminiService';
import { initialVocabulary } from './data/initialVocabulary';

// Types
interface Word {
  id: number;
  word: string;
  meaning: string;
  synonym: string;
  antonym: string;
  day_number: number;
}

interface Stats {
  totalWords: number;
  learnedWords: number;
  totalTests: number;
  avgAccuracy: number;
  streak: number;
  weakWords: string[];
}

// Components
const Navbar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-6 py-3 z-50 md:top-0 md:bottom-auto md:border-t-0 md:border-b">
    <div className="max-w-md mx-auto flex justify-between items-center md:max-w-4xl">
      <NavItem icon={<HomeIcon size={20} />} label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
      <NavItem icon={<BookOpen size={20} />} label="Daily" active={activeTab === 'daily'} onClick={() => setActiveTab('daily')} />
      <NavItem icon={<PenTool size={20} />} label="Exam" active={activeTab === 'exam'} onClick={() => setActiveTab('exam')} />
      <NavItem icon={<LayoutDashboard size={20} />} label="Stats" active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
    </div>
  </nav>
);

const NavItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-emerald-600' : 'text-zinc-400 hover:text-zinc-600'}`}
  >
    {icon}
    <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
  </button>
);

const Home = ({ stats, setActiveTab, onImport, onSeed }: { stats: Stats | null, setActiveTab: (tab: string) => void, onImport: () => void, onSeed: () => void }) => (
  <div className="space-y-8 pb-24 pt-4 md:pt-20">
    <header className="space-y-2">
      <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Assalamu Alaikum!</h1>
      <p className="text-zinc-500">Ready to master your HSC vocabulary today?</p>
    </header>

    <div className="grid grid-cols-2 gap-4">
      <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 space-y-2">
        <div className="flex items-center gap-2 text-emerald-600">
          <Flame size={20} />
          <span className="text-sm font-semibold uppercase tracking-wide">Streak</span>
        </div>
        <div className="text-3xl font-bold text-emerald-900">{stats?.streak || 0} Days</div>
      </div>
      <div className="bg-zinc-900 p-6 rounded-3xl text-white space-y-2">
        <div className="flex items-center gap-2 text-emerald-400">
          <Target size={20} />
          <span className="text-sm font-semibold uppercase tracking-wide">Learned</span>
        </div>
        <div className="text-3xl font-bold">{stats?.learnedWords || 0} Words</div>
      </div>
    </div>

    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-zinc-900">Quick Actions</h2>
      <div className="space-y-3">
        <ActionButton 
          title="Continue Learning" 
          subtitle="Pick up where you left off" 
          icon={<ChevronRight size={20} />} 
          onClick={() => setActiveTab('daily')}
        />
        <ActionButton 
          title="Take a Quick Test" 
          subtitle="Test your knowledge on Day 1-5" 
          icon={<ChevronRight size={20} />} 
          onClick={() => setActiveTab('exam')}
        />
        {(!stats || stats.totalWords === 0) && (
          <div className="space-y-3 pt-4">
            <button 
              onClick={onSeed}
              className="w-full p-6 bg-emerald-600 text-white rounded-3xl flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
            >
              <CheckCircle2 size={20} />
              <span className="font-bold">Restore Integrated Vocabulary</span>
            </button>
            <button 
              onClick={onImport}
              className="w-full p-6 bg-white border-2 border-dashed border-zinc-200 rounded-3xl flex items-center justify-center gap-3 text-zinc-500 hover:border-emerald-300 hover:text-emerald-600 transition-all"
            >
              <RefreshCw size={20} />
              <span className="font-medium">Import Custom Vocabulary</span>
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
);

const ActionButton = ({ title, subtitle, icon, onClick }: { title: string, subtitle: string, icon: React.ReactNode, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="w-full p-6 bg-white border border-zinc-100 rounded-3xl flex items-center justify-between hover:bg-zinc-50 transition-colors shadow-sm"
  >
    <div className="text-left">
      <h3 className="font-semibold text-zinc-900">{title}</h3>
      <p className="text-sm text-zinc-500">{subtitle}</p>
    </div>
    <div className="bg-zinc-100 p-2 rounded-full text-zinc-400">
      {icon}
    </div>
  </button>
);

const DailyVocabulary = ({ 
  days, 
  completedDays, 
  onCompleteDay 
}: { 
  days: number[], 
  completedDays: number[], 
  onCompleteDay: (day: number) => void 
}) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedDay) {
      setLoading(true);
      fetch(`/api/vocabulary/day/${selectedDay}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            setWords(data);
          } else {
            // Fallback to initial vocabulary for this day
            const dayWords = initialVocabulary.filter(w => w.day_number === selectedDay);
            // Map to include a fake ID if needed for keys
            setWords(dayWords.map((w, i) => ({ ...w, id: -1 - i })));
          }
          setLoading(false);
        })
        .catch(() => {
          // Fallback on error
          const dayWords = initialVocabulary.filter(w => w.day_number === selectedDay);
          setWords(dayWords.map((w, i) => ({ ...w, id: -1 - i })));
          setLoading(false);
        });
    }
  }, [selectedDay]);

  if (selectedDay) {
    return (
      <div className="space-y-6 pb-24 pt-4 md:pt-20">
        <button onClick={() => setSelectedDay(null)} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors">
          <ArrowLeft size={20} />
          <span className="font-medium">Back to Days</span>
        </button>

        <div className="flex justify-between items-end">
          <header className="space-y-1">
            <h1 className="text-3xl font-bold text-zinc-900">Day {selectedDay}</h1>
            <p className="text-zinc-500">{words.length} words to master</p>
          </header>
          {!completedDays.includes(selectedDay) && (
            <button 
              onClick={() => onCompleteDay(selectedDay)}
              className="bg-emerald-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <CheckCircle2 size={18} />
              Mark Complete
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-emerald-600" size={32} />
          </div>
        ) : (
          <div className="space-y-4">
            {words.map((word, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={word.id} 
                className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4"
              >
                <div className="flex justify-between items-start">
                  <h3 className="text-2xl font-bold text-zinc-900">{word.word}</h3>
                  <span className="text-emerald-600 font-bangla font-semibold bg-emerald-50 px-3 py-1 rounded-full text-sm leading-relaxed shadow-sm">
                    {word.meaning}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-50">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Synonym</span>
                    <p className="text-sm text-zinc-700 font-medium">{word.synonym || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Antonym</span>
                    <p className="text-sm text-zinc-700 font-medium">{word.antonym || 'N/A'}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 pt-4 md:pt-20">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Daily Lessons</h1>
        <p className="text-zinc-500">Pick a day to start your vocabulary journey.</p>
      </header>

      <div className="grid grid-cols-1 gap-3">
        {days.map((day) => (
          <button 
            key={day} 
            onClick={() => setSelectedDay(day)}
            className={`p-6 rounded-3xl border flex items-center justify-between transition-all ${
              completedDays.includes(day) 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-900' 
              : 'bg-white border-zinc-100 text-zinc-900 hover:border-emerald-200'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${
                completedDays.includes(day) ? 'bg-emerald-200 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
              }`}>
                {day}
              </div>
              <div className="text-left">
                <h3 className="font-bold">Day {day}</h3>
                <p className="text-xs opacity-60 uppercase tracking-wide font-semibold">
                  {completedDays.includes(day) ? 'Completed' : 'Not Started'}
                </p>
              </div>
            </div>
            {completedDays.includes(day) ? <CheckCircle2 className="text-emerald-600" /> : <ChevronRight className="text-zinc-300" />}
          </button>
        ))}
        {days.length === 0 && (
          <div className="text-center py-20 text-zinc-400 space-y-4">
            <AlertCircle size={48} className="mx-auto opacity-20" />
            <p>No vocabulary imported yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Exam = ({ days, completedDays }: { days: number[], completedDays: number[] }) => {
  const [examState, setExamState] = useState<'setup' | 'running' | 'result'>('setup');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [incorrectWords, setIncorrectWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const startExam = async (type: 'day' | 'range' | 'random', value?: any) => {
    setLoading(true);
    let wordsToTest: Word[] = [];
    
    if (type === 'day') {
      const res = await fetch(`/api/vocabulary/day/${value}`);
      wordsToTest = await res.json();
      if (wordsToTest.length === 0) {
        wordsToTest = initialVocabulary.filter(w => w.day_number === value);
      }
    } else if (type === 'range') {
      const res = await fetch(`/api/vocabulary`);
      const allWords: Word[] = await res.json();
      wordsToTest = allWords.filter(w => w.day_number >= value[0] && w.day_number <= value[1]);
      if (wordsToTest.length === 0) {
        wordsToTest = initialVocabulary.filter(w => w.day_number >= value[0] && w.day_number <= value[1]);
      }
    } else {
      const res = await fetch(`/api/vocabulary`);
      const allWords: Word[] = await res.json();
      wordsToTest = allWords.sort(() => 0.5 - Math.random()).slice(0, 20);
      if (wordsToTest.length === 0) {
        wordsToTest = [...initialVocabulary].sort(() => 0.5 - Math.random()).slice(0, 20);
      }
    }

    if (wordsToTest.length === 0) {
      alert("No words found for this exam.");
      setLoading(false);
      return;
    }

    // Generate questions
    const generatedQuestions = wordsToTest.map(word => {
      const qType = Math.floor(Math.random() * 3); // 0: Synonym, 1: Antonym, 2: Meaning -> Word
      let question = "";
      let correctAnswer = "";
      let options: string[] = [];

      if (qType === 0 && word.synonym) {
        question = `What is a synonym for "${word.word}"?`;
        correctAnswer = word.synonym.split(',')[0].trim();
      } else if (qType === 1 && word.antonym) {
        question = `What is an antonym for "${word.word}"?`;
        correctAnswer = word.antonym.split(',')[0].trim();
      } else {
        question = `Which word means "${word.meaning}"?`;
        correctAnswer = word.word;
      }

      // If synonym/antonym was empty, fallback to meaning
      if (!question) {
        question = `Which word means "${word.meaning}"?`;
        correctAnswer = word.word;
      }

      // Get distractors
      const distractors = wordsToTest
        .filter(w => w.word !== word.word)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map(w => qType === 2 ? w.word : (qType === 0 ? w.synonym?.split(',')[0].trim() : w.antonym?.split(',')[0].trim()) || w.meaning);
      
      options = [correctAnswer, ...distractors.filter(d => d && d !== correctAnswer)].slice(0, 4);
      while (options.length < 4) options.push("N/A");
      options = options.sort(() => 0.5 - Math.random());

      return { question, correctAnswer, options, word: word.word };
    });

    setQuestions(generatedQuestions);
    setExamState('running');
    setCurrentIdx(0);
    setScore(0);
    setIncorrectWords([]);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setLoading(false);
  };

  const handleAnswer = (answer: string) => {
    if (showFeedback) return;
    
    setSelectedAnswer(answer);
    setShowFeedback(true);

    if (answer === questions[currentIdx].correctAnswer) {
      setScore(s => s + 1);
    } else {
      setIncorrectWords(prev => [...prev, questions[currentIdx].word]);
    }
  };

  const nextQuestion = () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      finishExam();
    }
  };

  const finishExam = async () => {
    const accuracy = Math.round((score / questions.length) * 100);
    
    await fetch('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day_range: "Exam",
        score: score,
        total: questions.length,
        accuracy: accuracy,
        incorrect_words: incorrectWords
      })
    });
    setExamState('result');
  };

  if (examState === 'running') {
    const q = questions[currentIdx];
    return (
      <div className="space-y-8 pb-24 pt-4 md:pt-20 max-w-lg mx-auto">
        <div className="flex justify-between items-center text-zinc-400 font-bold text-xs uppercase tracking-widest">
          <span>Question {currentIdx + 1} of {questions.length}</span>
          <span>Score: {score}</span>
        </div>
        <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
          <motion.div 
            className="bg-emerald-500 h-full" 
            initial={{ width: 0 }}
            animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          />
        </div>

        <div className="space-y-6">
          <h2 className="text-lg font-bold text-zinc-900 text-center py-6 font-bangla leading-relaxed">
            {q.question.includes('"') ? (
              <>
                {q.question.split('"')[0]}"
                <span className="text-emerald-600">{q.question.split('"')[1]}</span>
                "{q.question.split('"')[2]}
              </>
            ) : q.question}
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {q.options.map((opt: string, i: number) => {
              const isCorrect = opt === q.correctAnswer;
              const isSelected = opt === selectedAnswer;
              
              let buttonClass = "w-full p-5 text-left bg-white border border-zinc-200 rounded-2xl font-bangla font-semibold text-sm text-zinc-700 transition-all shadow-sm leading-relaxed flex justify-between items-center";
              
              if (showFeedback) {
                if (isCorrect) {
                  buttonClass = "w-full p-5 text-left bg-emerald-50 border-emerald-500 text-emerald-700 rounded-2xl font-bangla font-semibold text-sm transition-all shadow-sm leading-relaxed flex justify-between items-center ring-2 ring-emerald-500/20";
                } else if (isSelected) {
                  buttonClass = "w-full p-5 text-left bg-red-50 border-red-500 text-red-700 rounded-2xl font-bangla font-semibold text-sm transition-all shadow-sm leading-relaxed flex justify-between items-center ring-2 ring-red-500/20";
                } else {
                  buttonClass = "w-full p-5 text-left bg-white border border-zinc-100 text-zinc-300 rounded-2xl font-bangla font-semibold text-sm transition-all shadow-sm leading-relaxed flex justify-between items-center opacity-40";
                }
              } else {
                buttonClass += " hover:border-emerald-500 hover:bg-emerald-50 active:scale-[0.98]";
              }

              return (
                <button 
                  key={i} 
                  onClick={() => handleAnswer(opt)}
                  disabled={showFeedback}
                  className={buttonClass}
                >
                  <span>{opt}</span>
                  {showFeedback && isCorrect && <CheckCircle className="text-emerald-600" size={24} />}
                  {showFeedback && isSelected && !isCorrect && <XCircle className="text-red-600" size={24} />}
                </button>
              );
            })}
          </div>

          {showFeedback && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={nextQuestion}
              className="w-full mt-6 bg-zinc-900 text-white py-4 rounded-3xl font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
            >
              {currentIdx + 1 < questions.length ? 'Next Question' : 'View Results'}
              <ChevronRight size={20} />
            </motion.button>
          )}
        </div>
      </div>
    );
  }

  if (examState === 'result') {
    const accuracy = Math.round((score / questions.length) * 100);
    return (
      <div className="space-y-8 pb-24 pt-4 md:pt-20 text-center max-w-lg mx-auto">
        <div className="bg-white p-10 rounded-[40px] border border-zinc-100 shadow-xl space-y-6">
          <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <Trophy size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-zinc-900">Exam Finished!</h1>
            <p className="text-zinc-500">Great effort! Here's how you did.</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="bg-zinc-50 p-4 rounded-3xl">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Score</div>
              <div className="text-2xl font-bold text-zinc-900">{score} / {questions.length}</div>
            </div>
            <div className="bg-zinc-50 p-4 rounded-3xl">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Accuracy</div>
              <div className="text-2xl font-bold text-zinc-900">{accuracy}%</div>
            </div>
          </div>

          {incorrectWords.length > 0 && (
            <div className="text-left space-y-3">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Words to Review</h3>
              <div className="flex flex-wrap gap-2">
                {incorrectWords.map(word => (
                  <span key={word} className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-semibold border border-red-100">
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={() => setExamState('setup')}
            className="w-full bg-zinc-900 text-white py-4 rounded-3xl font-bold hover:bg-zinc-800 transition-colors"
          >
            Back to Exams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 pt-4 md:pt-20">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Take Exam</h1>
        <p className="text-zinc-500">Test your knowledge and track your progress.</p>
      </header>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-900">Choose Exam Type</h2>
        <div className="grid grid-cols-1 gap-4">
          <ExamCard 
            title="Day-wise Test" 
            desc="Test words from a specific day" 
            icon={<BookOpen size={24} />} 
            onClick={() => {
              const day = prompt("Enter Day Number (e.g. 1):");
              if (day) startExam('day', parseInt(day));
            }}
          />
          <ExamCard 
            title="Combined Test" 
            desc="Test words from Day 1 to Day 5" 
            icon={<RefreshCw size={24} />} 
            onClick={() => startExam('range', [1, 5])}
          />
          <ExamCard 
            title="Random Challenge" 
            desc="20 random words from all your lessons" 
            icon={<Flame size={24} />} 
            onClick={() => startExam('random')}
          />
        </div>
      </div>
    </div>
  );
};

const ExamCard = ({ title, desc, icon, onClick }: { title: string, desc: string, icon: React.ReactNode, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="p-6 bg-white border border-zinc-100 rounded-3xl flex items-center gap-6 text-left hover:bg-zinc-50 transition-all shadow-sm group"
  >
    <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
      {icon}
    </div>
    <div>
      <h3 className="font-bold text-zinc-900">{title}</h3>
      <p className="text-sm text-zinc-500">{desc}</p>
    </div>
  </button>
);

const StatsDashboard = ({ stats }: { stats: Stats | null }) => (
  <div className="space-y-8 pb-24 pt-4 md:pt-20">
    <header className="space-y-2">
      <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Your Progress</h1>
      <p className="text-zinc-500">See how far you've come in your learning journey.</p>
    </header>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <StatCard label="Words Learned" value={stats?.learnedWords || 0} total={stats?.totalWords || 0} icon={<BookOpen className="text-blue-500" />} />
      <StatCard label="Tests Taken" value={stats?.totalTests || 0} icon={<PenTool className="text-purple-500" />} />
      <StatCard label="Avg. Accuracy" value={`${stats?.avgAccuracy || 0}%`} icon={<Target className="text-emerald-500" />} />
      <StatCard label="Current Streak" value={`${stats?.streak || 0} Days`} icon={<Flame className="text-orange-500" />} />
    </div>

    {stats?.weakWords && stats.weakWords.length > 0 && (
      <div className="bg-white p-8 rounded-[40px] border border-zinc-100 shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-zinc-900">
          <AlertCircle size={20} className="text-red-500" />
          <h2 className="text-xl font-bold">Weak Vocabulary</h2>
        </div>
        <p className="text-sm text-zinc-500">These are words you've missed most often in exams. Spend extra time on them!</p>
        <div className="flex flex-wrap gap-2">
          {stats.weakWords.map(word => (
            <span key={word} className="bg-zinc-50 text-zinc-600 px-4 py-2 rounded-2xl text-sm font-semibold border border-zinc-100">
              {word}
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
);

const StatCard = ({ label, value, total, icon }: { label: string, value: string | number, total?: number, icon: React.ReactNode }) => (
  <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm flex items-center gap-4">
    <div className="bg-zinc-50 p-3 rounded-2xl">{icon}</div>
    <div>
      <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{label}</div>
      <div className="text-2xl font-bold text-zinc-900">
        {value} {total !== undefined && <span className="text-sm text-zinc-300 font-medium">/ {total}</span>}
      </div>
    </div>
  </div>
);

const ImportModal = ({ isOpen, onClose, onImport }: { isOpen: boolean, onClose: () => void, onImport: (words: any[]) => void }) => {
  const [ocrText, setOcrText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!ocrText.trim()) return;
    setLoading(true);
    try {
      const words = await extractVocabFromText(ocrText);
      onImport(words);
      onClose();
    } catch (e) {
      alert("Failed to extract vocabulary. Please check your text format.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-lg rounded-[40px] p-8 space-y-6 shadow-2xl"
      >
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-zinc-900">Import Vocabulary</h2>
          <p className="text-sm text-zinc-500">Paste the OCR text from your vocabulary PDF here. AI will organize it for you.</p>
        </div>
        
        <textarea 
          value={ocrText}
          onChange={(e) => setOcrText(e.target.value)}
          placeholder="Paste OCR text here..."
          className="w-full h-64 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm font-mono"
        />

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleImport}
            disabled={loading || !ocrText.trim()}
            className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Process with AI'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [stats, setStats] = useState<Stats | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [completedDays, setCompletedDays] = useState<number[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      const [statsRes, daysRes, progressRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/vocabulary/days'),
        fetch('/api/progress')
      ]);
      
      const statsData = await statsRes.json();
      const daysData = await daysRes.json();
      const progressData = await progressRes.json();

      setStats(statsData);
      
      if (daysData.length > 0) {
        setDays(daysData);
      } else {
        // Fallback to initial vocabulary days if DB is empty
        const initialDays = Array.from(new Set(initialVocabulary.map(w => w.day_number))).sort((a, b) => a - b);
        setDays(initialDays);
      }
      
      setCompletedDays(progressData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      // Fallback on error too
      const initialDays = Array.from(new Set(initialVocabulary.map(w => w.day_number))).sort((a, b) => a - b);
      setDays(initialDays);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCompleteDay = async (day: number) => {
    await fetch(`/api/progress/complete/${day}`, { method: 'POST' });
    fetchData();
  };

  const handleImportWords = async (words: any[]) => {
    await fetch('/api/vocabulary/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words })
    });
    fetchData();
  };

  const handleSeedInitial = async () => {
    try {
      const response = await fetch('/api/vocabulary/seed', { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        fetchData();
        alert(`Successfully seeded ${result.count} words!`);
      } else {
        alert("Seeding failed: " + (result.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Error seeding data: " + (e.message || "Network error"));
      console.error("Seeding error:", e);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <div className="max-w-md mx-auto px-6 md:max-w-4xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'home' && (
              <Home 
                stats={stats} 
                setActiveTab={setActiveTab} 
                onImport={() => setIsImportModalOpen(true)} 
                onSeed={handleSeedInitial}
              />
            )}
            {activeTab === 'daily' && <DailyVocabulary days={days} completedDays={completedDays} onCompleteDay={handleCompleteDay} />}
            {activeTab === 'exam' && <Exam days={days} completedDays={completedDays} />}
            {activeTab === 'stats' && <StatsDashboard stats={stats} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImport={handleImportWords} 
      />
    </div>
  );
}
