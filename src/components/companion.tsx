'use client';
import { Component,type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type { CharacterProps } from './character';
const Rig=dynamic(()=>import('./character'),{ssr:false});
class SceneBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}
// A failed lazy animation chunk must never take the planner with it.
export default function Companion(props:CharacterProps){return <SceneBoundary fallback={<img className={`character ${props.className??''}`} src={`/characters/${props.character??'pip'}.svg`} alt="" aria-hidden="true"/>}><Rig {...props}/></SceneBoundary>;}
