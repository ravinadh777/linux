"""Convenience re-export so agent code can build + encode AG-UI events in one place.

    from . import agui_emit as emit
    yield emit.frame(emit.text_message_content(msg_id, "hi"))
"""
from ..agui.events import (  # noqa: F401
    custom,
    encode,
    run_error,
    run_finished,
    run_started,
    state_delta,
    state_snapshot,
    step_finished,
    step_started,
    text_message_content,
    text_message_end,
    text_message_start,
    tool_call_args,
    tool_call_end,
    tool_call_result,
    tool_call_start,
)

frame = encode
