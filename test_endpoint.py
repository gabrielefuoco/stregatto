import requests

def test():
    # 1. Normal user message with string content
    r1 = requests.post("http://127.0.0.1:1865/agents/workspace/message", json={
        "messages": [{"role": "user", "content": "hello"}]
    })
    print("r1", r1.status_code, r1.text)

    # 2. User message with array content
    r2 = requests.post("http://127.0.0.1:1865/agents/workspace/message", json={
        "messages": [{"role": "user", "content": [{"type": "text", "text": "hello"}]}]
    })
    print("r2", r2.status_code, r2.text)

    # 3. Tool role
    r3 = requests.post("http://127.0.0.1:1865/agents/workspace/message", json={
        "messages": [
            {"role": "user", "content": "hello"},
            {"role": "tool", "content": "tool result"}
        ]
    })
    print("r3", r3.status_code, r3.text)

if __name__ == "__main__":
    test()
