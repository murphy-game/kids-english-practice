import { NavLink,Route,Routes } from 'react-router-dom'
import Home from './pages/Home'
import Practice from './pages/Practice'
import ContentCheck from './pages/ContentCheck'
export default function App(){return <div className="min-h-screen bg-orange-50 text-slate-800"><header className="border-b bg-white"><nav className="mx-auto flex max-w-6xl gap-4 p-4 text-sm font-semibold"><NavLink to="/">Home</NavLink><NavLink to="/practice">Practice</NavLink><NavLink to="/content-check">Content Check</NavLink></nav></header><Routes><Route path="/" element={<Home/>}/><Route path="/practice" element={<Practice/>}/><Route path="/content-check" element={<ContentCheck/>}/></Routes></div>}
