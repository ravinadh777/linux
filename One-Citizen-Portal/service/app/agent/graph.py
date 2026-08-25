"""The LangGraph agent graph.

A classic tool-calling ReAct loop expressed as a LangGraph `StateGraph`:

    agent ──(tool_calls?)──▶ tools ──▶ agent ──(no tool_calls)──▶ END

`shared` carries the page context + resolved profile so the system prompt can be
rebuilt per turn. Tools read the profile out-of-band via the run ContextVar.
"""
from __future__ import annotations

from typing import Annotated, Any, TypedDict

from langchain_core.messages import SystemMessage, ToolMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from ..tools import TOOLS, TOOLS_BY_NAME
from .prompts import build_system_prompt


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    shared: dict[str, Any]


def build_graph(llm):
    llm_with_tools = llm.bind_tools(list(TOOLS))

    async def agent_node(state: AgentState) -> dict[str, Any]:
        shared = state.get("shared", {})
        system = SystemMessage(
            content=build_system_prompt(shared.get("page"), shared.get("user"))
        )
        response = await llm_with_tools.ainvoke([system, *state["messages"]])
        return {"messages": [response]}

    async def tool_node(state: AgentState) -> dict[str, Any]:
        last = state["messages"][-1]
        results: list[ToolMessage] = []
        for call in getattr(last, "tool_calls", []) or []:
            tool = TOOLS_BY_NAME.get(call["name"])
            if tool is None:
                output = f"Unknown tool: {call['name']}"
            else:
                output = await tool.ainvoke(call["args"])
            results.append(
                ToolMessage(content=str(output), tool_call_id=call["id"], name=call["name"])
            )
        return {"messages": results}

    def route(state: AgentState) -> str:
        last = state["messages"][-1]
        return "tools" if getattr(last, "tool_calls", None) else END

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", route, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")
    return graph.compile()
