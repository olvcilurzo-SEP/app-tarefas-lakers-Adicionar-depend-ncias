import { useState, useEffect, FormEvent } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  ListTodo,
  Tag,
  Search,
  Flag,
  Calendar,
  Edit2,
  X,
  Save,
  EyeOff,
  Eye,
} from 'lucide-react';

// Importações necessárias para salvar dados na Nuvem (Firebase)
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';

// =========================================================================
// COLE AQUI AS SUAS CHAVES DO FIREBASE (Substitua os valores entre aspas)
// =========================================================================
const firebaseConfig = {
  apiKey: 'AIzaSyACL_MNmAaUTsITvAyeQWNJM6Tm8Yo8dHo',
  authDomain: 'lista-de-tarefas-34c6e.firebaseapp.com',
  projectId: 'lista-de-tarefas-34c6e',
  storageBucket: 'lista-de-tarefas-34c6e.firebasestorage.app',
  messagingSenderId: '410253926230',
  appId: '1:410253926230:web:48c4ab934ce7c4a40dc0f7',
  measurementId: 'G-5W417YJCG9',
};

// Inicializando os serviços do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Definição do formato da nossa Tarefa (TypeScript Interface)
interface Todo {
  id: string;
  text: string;
  completed: boolean;
  category: string;
  priority: string;
  dueDate: string;
  createdAt?: number;
}

// Helper: Obter a data de hoje no formato YYYY-MM-DD ajustada ao fuso horário local
const getTodayString = (): string => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().split('T')[0];
};

// Helper: Formatar datas amigáveis (Hoje, Amanhã, Quinta, etc.)
const formatFriendlyDate = (dateString?: string): string | null => {
  if (!dateString) return null;

  const [year, month, day] = dateString.split('-');
  const taskDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = taskDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  if (diffDays === -1) return 'Ontem';

  if (diffDays > 1 && diffDays < 7) {
    const days = [
      'Domingo',
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado',
    ];
    return days[taskDate.getDay()];
  }

  return `${day}/${month}`;
};

// Definição das categorias e as suas respetivas cores
const CATEGORIES: Record<string, string> = {
  Geral: 'bg-slate-100 text-slate-700',
  Academia: 'bg-green-100 text-green-700',
  Contas: 'bg-red-100 text-red-700',
  Trabalho: 'bg-purple-100 text-purple-700',
  Casa: 'bg-orange-100 text-orange-700',
  Estudos: 'bg-yellow-100 text-yellow-700',
};

// Definição dos níveis de prioridade
const PRIORITIES: Record<string, string> = {
  Urgente: 'bg-red-100 text-red-800 border-red-200',
  Importante: 'bg-orange-100 text-orange-800 border-orange-200',
  Normal: 'bg-blue-100 text-blue-800 border-blue-200',
  'No radar': 'bg-slate-100 text-slate-600 border-slate-200',
};

// Pesos para ordenação de prioridades (Maior = mais importante)
const PRIORITY_WEIGHTS: Record<string, number> = {
  Urgente: 4,
  Importante: 3,
  Normal: 2,
  'No radar': 1,
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Geral');
  const [selectedPriority, setSelectedPriority] = useState<string>('Normal');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState<boolean>(true);

  // 1. Autenticação na Nuvem (Login com Google)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import(
        'firebase/auth'
      );
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      alert(
        'Erro ao fazer login. Verifique se ativou o Google Auth no Firebase.'
      );
    }
  };

  // 2. Carregar dados sincronizados da Nuvem
  useEffect(() => {
    if (!user) return;

    const todosRef = collection(db, 'users', user.uid, 'todos');
    const q = query(todosRef);

    // Tipagem explícita com 'any' para evitar erros de compilação rigorosos
    const unsubscribe = onSnapshot(
      q,
      (snapshot: any) => {
        const fetchedTodos: Todo[] = [];
        snapshot.forEach((doc: any) => {
          fetchedTodos.push({ id: doc.id, ...doc.data() } as Todo);
        });
        setTodos(fetchedTodos);
      },
      (error: any) => {
        console.error('Erro ao sincronizar tarefas:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Lógica de Estatísticas Inteligentes (Foco Diário)
  const todayStr = getTodayString();
  const todayTasks = todos.filter((t) => t.dueDate && t.dueDate <= todayStr);
  const hasTodayTasks = todayTasks.length > 0;

  const statTasks = hasTodayTasks ? todayTasks : todos;
  const totalTasks = statTasks.length;
  const completedTasks = statTasks.filter((t) => t.completed).length;
  const completionRate =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  // Submeter formulário (Adicionar ou Editar na Nuvem)
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !user) return;

    if (editingId) {
      const docRef = doc(db, 'users', user.uid, 'todos', editingId);
      await updateDoc(docRef, {
        text: inputValue,
        category: selectedCategory,
        priority: selectedPriority,
        dueDate: selectedDate,
      });
      setEditingId(null);
      setSelectedCategory('Geral');
      setSelectedPriority('Normal');
    } else {
      const todosRef = collection(db, 'users', user.uid, 'todos');
      await addDoc(todosRef, {
        text: inputValue,
        completed: false,
        category: selectedCategory,
        priority: selectedPriority,
        dueDate: selectedDate,
        createdAt: Date.now(),
      });
    }

    setInputValue('');
    setSelectedDate('');
  };

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setInputValue(todo.text);
    setSelectedCategory(todo.category || 'Geral');
    setSelectedPriority(todo.priority || 'Normal');
    setSelectedDate(todo.dueDate || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setInputValue('');
    setSelectedCategory('Geral');
    setSelectedPriority('Normal');
    setSelectedDate('');
  };

  const toggleTodo = async (id: string) => {
    if (!user) return;
    const todo = todos.find((t) => t.id === id);
    if (todo) {
      const docRef = doc(db, 'users', user.uid, 'todos', id);
      await updateDoc(docRef, { completed: !todo.completed });
    }
  };

  const deleteTodo = async (id: string) => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid, 'todos', id);
    await deleteDoc(docRef);
  };

  // Filtrar, Pesquisar e Ordenar tarefas
  const filteredAndSortedTodos = todos
    .filter((todo) => {
      if (
        searchQuery &&
        !todo.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      if (!showCompleted && todo.completed) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      if (a.dueDate && b.dueDate) {
        const dateA = new Date(a.dueDate).getTime();
        const dateB = new Date(b.dueDate).getTime();
        if (dateA !== dateB) return dateA - dateB;
      } else if (a.dueDate && !b.dueDate) {
        return -1;
      } else if (!a.dueDate && b.dueDate) {
        return 1;
      }

      if (PRIORITY_WEIGHTS[a.priority] !== PRIORITY_WEIGHTS[b.priority]) {
        return PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
      }

      return (b.createdAt || 0) - (a.createdAt || 0);
    });

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#552583] p-8 text-center flex flex-col items-center">
          <div className="bg-[#552583] p-4 rounded-full text-[#FDB927] mb-6">
            <ListTodo size={48} />
          </div>
          <h1 className="text-2xl font-bold text-[#552583] mb-2">
            A Minha Lista de Tarefas
          </h1>
          <p className="text-slate-500 mb-8">
            Faça login com o Google para sincronizar as suas tarefas entre o
            telemóvel e o computador.
          </p>
          <button
            onClick={loginWithGoogle}
            className="w-full bg-[#FDB927] hover:bg-[#e5a620] text-[#552583] font-bold py-4 px-4 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#552583]">
        {/* Cabeçalho */}
        <div className="bg-[#552583] p-6 text-[#FDB927] flex items-center gap-3">
          <ListTodo size={28} />
          <h1 className="text-2xl font-bold">A Minha Lista de Tarefas</h1>
        </div>

        <div className="p-6">
          {/* Estatísticas de Progresso Inteligente */}
          <div className="mb-6 bg-[#552583]/5 rounded-xl p-4 border border-[#552583]/10">
            <div className="flex justify-between items-end mb-3">
              <div>
                <h2 className="text-sm font-bold text-[#552583] uppercase tracking-wider">
                  {hasTodayTasks ? 'Foco de Hoje' : 'Progresso Geral'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {hasTodayTasks
                    ? `${completedTasks} de ${totalTasks} tarefas para hoje concluídas`
                    : totalTasks > 0
                    ? `${completedTasks} de ${totalTasks} tarefas concluídas no total`
                    : 'Adicione a sua primeira tarefa!'}
                </p>
              </div>
              <span className="text-3xl font-black text-[#FDB927] drop-shadow-sm">
                {completionRate}%
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-[#552583] h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${completionRate}%` }}
              ></div>
            </div>
          </div>

          {/* Barra de Pesquisa */}
          <div className="mb-6 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#552583]/50"
              size={20}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar tarefas..."
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FDB927] focus:border-[#552583] bg-white transition-all shadow-sm"
            />
          </div>

          {/* Formulário de adição/edição */}
          <form
            onSubmit={handleSubmit}
            className={`mb-6 flex flex-col gap-3 p-4 rounded-xl border transition-all ${
              editingId
                ? 'bg-[#FDB927]/10 border-[#FDB927]'
                : 'bg-slate-50 border-[#552583]/20'
            }`}
          >
            {editingId && (
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-[#552583] uppercase tracking-wider flex items-center gap-1">
                  <Edit2 size={12} /> Editando Tarefa
                </span>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1 flex items-center gap-1"
                  title="Cancelar edição"
                >
                  <span className="text-xs font-medium">Cancelar</span>
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  editingId
                    ? 'Atualizar nome da tarefa...'
                    : 'O que precisa de ser feito?'
                }
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FDB927] focus:border-[#552583] bg-white transition-all"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center justify-center font-bold text-[#552583] ${
                  editingId
                    ? 'bg-green-400 hover:bg-green-500 disabled:bg-green-200 text-white'
                    : 'bg-[#FDB927] hover:bg-[#e5a620] disabled:bg-[#FDB927]/50'
                }`}
                title={editingId ? 'Salvar alterações' : 'Adicionar tarefa'}
              >
                {editingId ? <Save size={24} /> : <Plus size={24} />}
              </button>
            </div>

            {/* Seleção de Categoria */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <Tag size={16} className="text-[#552583]/60 shrink-0" />
              {Object.keys(CATEGORIES).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? `${CATEGORIES[cat]} ring-2 ring-[#552583] shadow-sm`
                      : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Seleção de Prioridade */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <Flag size={16} className="text-[#552583]/60 shrink-0" />
              {Object.keys(PRIORITIES).map((pri) => (
                <button
                  key={pri}
                  type="button"
                  onClick={() => setSelectedPriority(pri)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                    selectedPriority === pri
                      ? `${PRIORITIES[pri]} ring-2 ring-offset-1 ring-[#552583] shadow-sm`
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {pri}
                </button>
              ))}
            </div>

            {/* Seleção de Data */}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#552583]/10">
              <Calendar size={16} className="text-[#552583]/60 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#FDB927] focus:border-[#552583] bg-white cursor-pointer"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="text-[10px] text-red-500 hover:text-red-700 font-medium ml-2"
                >
                  Remover data
                </button>
              )}
            </div>
          </form>

          {/* Lista de tarefas */}
          <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
            {filteredAndSortedTodos.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                {searchQuery ? (
                  <p>Nenhuma tarefa encontrada com "{searchQuery}".</p>
                ) : !showCompleted && todos.some((t) => t.completed) ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="text-green-400" size={32} />
                    <p>Tudo limpo por aqui!</p>
                    <button
                      onClick={() => setShowCompleted(true)}
                      className="text-xs text-[#552583] underline mt-2"
                    >
                      Mostrar tarefas concluídas
                    </button>
                  </div>
                ) : (
                  <>
                    <p>Nenhuma tarefa por enquanto.</p>
                    <p className="text-sm mt-1">
                      Adicione uma acima para começar!
                    </p>
                  </>
                )}
              </div>
            ) : (
              filteredAndSortedTodos.map((todo) => (
                <div
                  key={todo.id}
                  className={`flex items-center justify-between p-4 border rounded-xl transition-all ${
                    todo.completed
                      ? 'bg-slate-50 border-slate-100'
                      : 'bg-white border-slate-200 hover:border-[#FDB927]'
                  }`}
                >
                  <div
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => toggleTodo(todo.id)}
                  >
                    {todo.completed ? (
                      <CheckCircle
                        className="text-[#552583] shrink-0"
                        size={24}
                      />
                    ) : (
                      <Circle className="text-slate-300 shrink-0" size={24} />
                    )}
                    <div className="flex flex-col gap-1">
                      <span
                        className={`text-slate-700 transition-all ${
                          todo.completed
                            ? 'line-through text-slate-400'
                            : 'font-medium'
                        }`}
                      >
                        {todo.text}
                      </span>
                      <div className="flex gap-2 items-center flex-wrap mt-0.5">
                        {todo.dueDate && (
                          <span
                            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full w-fit font-bold tracking-wider border border-blue-200 bg-blue-50 text-blue-700 ${
                              todo.completed ? 'opacity-50 grayscale' : ''
                            }`}
                          >
                            <Calendar size={10} />
                            {formatFriendlyDate(todo.dueDate)}
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full w-fit uppercase font-bold tracking-wider ${
                            CATEGORIES[todo.category || 'Geral']
                          } ${todo.completed ? 'opacity-50 grayscale' : ''}`}
                        >
                          {todo.category || 'Geral'}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full w-fit uppercase font-bold tracking-wider border ${
                            PRIORITIES[todo.priority || 'Normal']
                          } ${todo.completed ? 'opacity-50 grayscale' : ''}`}
                        >
                          {todo.priority || 'Normal'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => startEdit(todo)}
                      className="text-slate-300 hover:text-[#552583] transition-colors p-2 rounded-lg hover:bg-[#552583]/10"
                      title="Editar tarefa"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"
                      title="Excluir tarefa permanentemente"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rodapé Inteligente com Ocultar/Mostrar */}
        {todos.length > 0 && (
          <div className="bg-[#552583]/5 p-4 border-t border-[#552583]/10 flex justify-between items-center text-sm text-[#552583] font-medium">
            <span>
              {todos.filter((t) => !t.completed).length} pendentes no total
            </span>

            {todos.some((t) => t.completed) && (
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="hover:text-[#FDB927] hover:bg-[#552583] px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
              >
                {showCompleted ? (
                  <>
                    <EyeOff size={16} /> Ocultar concluídas
                  </>
                ) : (
                  <>
                    <Eye size={16} /> Mostrar concluídas
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
