package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Server struct {
	mu    sync.Mutex
	Peers map[string]*websocket.Conn
}

type Message struct {
	MessageType string   `json:"type"`
	SrcPid      string   `json:"srcId"`
	DstPid      string   `json:"dstId"`
	Offer       string   `json:"offer"`
	Answer      string   `json:"answer"`
	Peers       []string `json:"peers"`
}

func NewServer() *Server {
	return &Server{
		mu:    sync.Mutex{},
		Peers: make(map[string]*websocket.Conn),
	}
}

func (s *Server) AddPeer(peerId string, conn *websocket.Conn) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if oldConn, exists := s.Peers[peerId]; exists {
		oldConn.Close()
	}

	s.Peers[peerId] = conn
	s.SignalPeers(peerId)
}

func (s *Server) RemovePeer(peerId string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.Peers, peerId)
	s.BroadcastPeerList()
}

// This method signals the other peers that a new peer got added
func (s *Server) SignalPeers(newPeerId string) {
	for peerId, conn := range s.Peers {
		if peerId != newPeerId {
			msg := Message{
				MessageType: "signal",
				SrcPid:      newPeerId,
			}

			msgJson, err := json.Marshal(msg)
			if err != nil {
				log.Println("error marshalling signal message for peer ", newPeerId)
				return
			}

			conn.WriteMessage(websocket.TextMessage, msgJson)
		}
	}
}

func (s *Server) BroadcastPeerList() {
	msg := Message{
		MessageType: "broadcast",
		Peers:       make([]string, 0),
	}

	for peerId := range s.Peers {
		msg.Peers = append(msg.Peers, peerId)
	}

	msgJson, err := json.Marshal(msg)
	if err != nil {
		log.Println("error marshalling broadcast data")
		return
	}

	for _, conn := range s.Peers {
		conn.WriteMessage(websocket.TextMessage, msgJson)
	}
}

func (s *Server) ReadLoop(peerId string, conn *websocket.Conn) {
	defer conn.Close()

	for {
		_, data, err := conn.ReadMessage()

		if err != nil {
			log.Println("Conn closed ", err.Error())
			s.RemovePeer(peerId)
			return
		}

		log.Printf("Received - %s\n", string(data))
		var sigMsg Message
		err = json.Unmarshal(data, &sigMsg)
		if err != nil {
			log.Println("error unmarshalling the error message")
		}

		if dstConn, exists := s.Peers[sigMsg.DstPid]; exists {
			dstConn.WriteMessage(websocket.TextMessage, data)
		}
	}
}

func (s *Server) HandlePeerJoin(w http.ResponseWriter, r *http.Request) {
	peerId := r.URL.Query().Get("peerId")
	if peerId == "" {
		log.Println("Peer id empty ")
		http.Error(w, "peer id is empty", http.StatusBadRequest)
		return
	}

	log.Println("Peer id ", peerId)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading the connection ", err.Error())
		return
	}

	s.AddPeer(peerId, conn)
	go s.ReadLoop(peerId, conn)
}

func main() {
	s := NewServer()
	http.HandleFunc("/ws", s.HandlePeerJoin)

	log.Fatal(http.ListenAndServe("localhost:6969", nil))
}
